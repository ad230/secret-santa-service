use std::{
    collections::HashMap,
    env,
    io::Error as IoError,
    net::SocketAddr,
    sync::{Arc, Mutex},
    vec::Vec,
};

use futures_channel::mpsc::{unbounded, UnboundedSender};
use futures_util::{future, pin_mut, stream::TryStreamExt, StreamExt};

use http::header::{HeaderValue, SEC_WEBSOCKET_PROTOCOL};

use serde::{Deserialize, Serialize};

use tokio::net::{TcpListener, TcpStream};
use tungstenite::{
    handshake::server::{ErrorResponse, Request, Response},
    protocol::Message,
};

type Sender = UnboundedSender<Message>;
struct PeerStruct {
    protocol: HeaderValue,
    sender: Sender,
}
type PeerMap = Arc<Mutex<HashMap<SocketAddr, PeerStruct>>>;

/* MESSAGE STRUCTS */
#[derive(Clone, Debug, Serialize, Deserialize)]
struct JsonWebKey {
    crv: String,
    ext: bool,
    key_ops: Vec<String>,
    kty: String,
    x: String,
    y: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct EncryptedRecvStruct {
    cipher: String,
    initialization_vector: String,
    recv_addr: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(untagged)]
enum BroadcastRecvEnum {
    EncryptedRecvType {
        cipher: String,
        initialization_vector: String,
        recv_addr: SocketAddr,
    },
    MetaPreStruct {
        meta: u8,
    },
    PlaintextRecvStruct {
        plaintext: String,
    },
    PublicKeyRecvStruct {
        public_key: JsonWebKey,
    },
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(untagged)]
enum BroadcastSendEnum {
    EncryptedSendType {
        cipher: String,
        initialization_vector: String,
        sender_addr: SocketAddr,
    },
    MetaSendStruct {
        meta: u8,
        sender_addr: SocketAddr,
    },
    PlaintextSendStruct {
        plaintext: String,
        sender_addr: SocketAddr,
    },
    PublicKeySendStruct {
        public_key: JsonWebKey,
        sender_addr: SocketAddr,
    },
}

async fn handle_connection(peer_map: PeerMap, raw_stream: TcpStream, client_addr: SocketAddr) {
    println!(
        "Incoming TCP connection from: {}, raw stream: {}",
        client_addr,
        raw_stream.local_addr().unwrap()
    );

    let mut protocol = HeaderValue::from_static("");
    let copy_headers_callback =
        |request: &Request, mut response: Response| -> Result<Response, ErrorResponse> {
            protocol = request
                .headers()
                .get(SEC_WEBSOCKET_PROTOCOL)
                .expect("the client should specify a protocol")
                .to_owned();

            response
                .headers_mut()
                .insert(SEC_WEBSOCKET_PROTOCOL, protocol.to_owned());
            Ok(response)
        };

    let ws_stream = tokio_tungstenite::accept_hdr_async(raw_stream, copy_headers_callback)
        .await
        .expect("Error during the websocket handshake occurred");
    println!("WebSocket connection established: {}", client_addr);

    let (sender, receiver) = unbounded();
    peer_map.lock().unwrap().insert(
        client_addr,
        PeerStruct {
            protocol: protocol.to_owned(),
            sender,
        },
    );

    let send_message = |recv: BroadcastRecvEnum| {
        let peers = peer_map.lock().unwrap();
        let sender_addr = client_addr.to_owned();

        let recv_cloned = recv.clone();

        let message: BroadcastSendEnum = match recv {
            BroadcastRecvEnum::EncryptedRecvType {
                cipher,
                initialization_vector,
                recv_addr: _,
            } => BroadcastSendEnum::EncryptedSendType {
                cipher,
                initialization_vector,
                sender_addr,
            },
            BroadcastRecvEnum::MetaPreStruct { meta } => {
                BroadcastSendEnum::MetaSendStruct { meta, sender_addr }
            }
            BroadcastRecvEnum::PlaintextRecvStruct { plaintext } => {
                BroadcastSendEnum::PlaintextSendStruct {
                    plaintext,
                    sender_addr,
                }
            }
            BroadcastRecvEnum::PublicKeyRecvStruct { public_key } => {
                BroadcastSendEnum::PublicKeySendStruct {
                    public_key,
                    sender_addr,
                }
            }
        };

        let send =
            Message::Text(serde_json::to_string(&message).expect("problem serializing message"));
        println!("New message {}", send.to_text().unwrap());

        let recv_addr_option: Option<SocketAddr> = match recv_cloned {
            BroadcastRecvEnum::EncryptedRecvType {
                cipher: _,
                initialization_vector: _,
                recv_addr,
            } => Some(recv_addr),
            _ => None,
        };

        let broadcast_recipients = peers
            .iter()
            .filter(|(peer_addr, _)| {
                peer_addr != &&client_addr
                    && (peers
                        .get(peer_addr)
                        .expect("peer_addr should be a key in the HashMap")
                        .protocol
                        .to_str()
                        .expect("expected a string")
                        == protocol.to_str().expect("expected a string"))
                    && (match recv_addr_option {
                        Some(recv_addr) => &&recv_addr == peer_addr,
                        None => true,
                    })
            })
            .map(|(_, ws_sink)| ws_sink);

        for recp in broadcast_recipients {
            recp.sender
                .unbounded_send(send.clone())
                .expect("Failed to send message");
        }
    };

    send_message(BroadcastRecvEnum::MetaPreStruct { meta: 0 });

    /* WAITING FOR MESSAGES */

    let (outgoing, incoming) = ws_stream.split();

    let broadcast_incoming = incoming.try_for_each(|msg| {
        println!(
            "Received a message from {}: {}",
            client_addr,
            msg.to_text().unwrap()
        );

        if msg.to_text().unwrap() != "" {
            let recv = serde_json::from_str(msg.to_text().unwrap()).unwrap();
            send_message(recv);
        }

        future::ok(())
    });
    let receive_from_others = receiver.map(Ok).forward(outgoing);
    pin_mut!(broadcast_incoming, receive_from_others);
    future::select(broadcast_incoming, receive_from_others).await;

    /* DISCONNECTING */

    send_message(BroadcastRecvEnum::MetaPreStruct { meta: 1 });

    let mut peers_disconnect = peer_map.lock().unwrap();
    println!("{} DISCONNECTED---------------------------", &client_addr);
    peers_disconnect.remove(&client_addr);
}

#[tokio::main]
async fn main() -> Result<(), IoError> {
    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let server_addr = format!("0.0.0.0:{}", port);

    let state = PeerMap::new(Mutex::new(HashMap::new()));

    let try_socket = TcpListener::bind(&server_addr).await;
    let listener = try_socket.expect("Failed to bind");
    println!("Listening on: {}", server_addr);

    while let Ok((stream, client_addr)) = listener.accept().await {
        tokio::spawn(handle_connection(state.clone(), stream, client_addr));
    }

    Ok(())
}