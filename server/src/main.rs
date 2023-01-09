use std::{
    collections::HashMap,
    env,
    net::SocketAddr,
    sync::{Arc, Mutex},
};

use futures_channel::mpsc::{unbounded, UnboundedSender};

use http::header::{HeaderValue, SEC_WEBSOCKET_PROTOCOL};

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

#[tokio::main]
async fn main() {
    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let server_addr = format!("0.0.0.0:{}", port);

    let state = PeerMap::new(Mutex::new(HashMap::new()));
    
    let try_socket = TcpListener::bind(&server_addr).await;
}