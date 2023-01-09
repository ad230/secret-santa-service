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

async fn handle_connection(peer_map: PeerMap, raw_stream: TcpStream, client_addr: SocketAddr) {
    println!(
        "Incoming TCP connection from: {}, raw stream: {}",
        client_addr,
        raw_stream.local_addr().unwrap()
    );
}

#[tokio::main]
async fn main() {
    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let server_addr = format!("0.0.0.0:{}", port);

    let state = PeerMap::new(Mutex::new(HashMap::new()));
    
    let try_socket = TcpListener::bind(&server_addr).await;
    let listener = try_socket.expect("Failed to bind");
    println!("Listening on: {}", server_addr);

    while let Ok((stream, client_addr)) = listener.accept().await {
    }

    Ok(())
}