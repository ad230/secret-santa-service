use std::{
    env,
};

fn main() {
    // Get the port number to listen on (required for heroku deployment).
    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let server_addr = format!("0.0.0.0:{}", port);
}