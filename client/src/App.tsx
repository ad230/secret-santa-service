import React from "react";
import { withRouter, RouteComponentProps } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDoorOpen } from "@fortawesome/free-solid-svg-icons";

import clientPackage from "../package.json";
import {
  MetaEnum,
  Name,
  MetaRecvType,
  PlaintextRecvType,
  PlaintextSendType,
} from "utils/types";

import Chat, { ChatType, ChatTypeType } from "Components/Chat/Chat";
import DisplaySender from "Components/DisplaySender/DisplaySender";

import "App.scss";

type Props = RouteComponentProps;

interface State {
  input: string;
  chats: ChatType[];
  newRoom: string;
  newName: string;
  socketReadyState: number;
}

const WS_SERVER_URL =
  process.env.REACT_APP_WS_SERVER_URL || "ws://localhost:8080";

class App extends React.Component<Props, State> {
  lastDate: Date = new Date();
  lastSenderAddr: string = "";
  lastType: string = "";

  pingInterval: number = -1;
  senderData: {
    [senderAddr: string]: Name;
  } = {};
  socket: WebSocket;

  constructor(props: Props) {
    super(props);

    this.state = {
      input: "",
      chats: [
        {
          content:
            "Дарова, братюна. Тут на нарах тебе придется раскашелится. Мы укажем куда стучать",
          date: new Date(),
          senderAddr: "Boss of Santas",
          showSenderAddr: true,
          type: "user",
        },
      ],
      newRoom: "",
      newName: "",
      socketReadyState: 0,
    };

    //@ts-ignore
    this.socket = null;
  }

  componentDidMount() {
    this.socket = this.setUpSocket();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.location.pathname !== this.props.location.pathname) {
      this.breakdownSocket();
      this.socket = this.setUpSocket();
    }
  }

  componentWillUnmount() {
    this.breakdownSocket();
  }

  setUpSocket = () => {
    this.setState({ socketReadyState: 0 });

    const socket = new WebSocket(
      WS_SERVER_URL,
      this.props.location.pathname.replace(/\//gi, "-") //pass the URL pathname as the protocol ('/' characters are replaced with '-')
    );

    socket.onopen = () => {
      this.addChat(
        <span>
          You have joined the chat room{" "}
          <span className="blob">{this.props.location.pathname}</span>
        </span>,
        "self",
        "meta"
      );

      this.setState({ socketReadyState: socket.readyState });

      clearInterval(this.pingInterval);
      this.pingInterval = window.setInterval(() => this.send({plaintext: "", name: this.state.newName}), 3000);
    };

    socket.onmessage = async (message: MessageEvent<any>) => {
      try {
        await this.processSocketMessage(message);
      } catch (err) {
        console.error(err);
      }
    };

    socket.onclose = () => {
      this.setState({ socketReadyState: socket.readyState });
    };

    return socket;
  };

  breakdownSocket = () => {
    this.socket.close();
    this.senderData = {};
  };

  send = (obj: Object) => {
    this.socket.send(JSON.stringify(obj));
  };

  processSocketMessage = async (message: MessageEvent) => {
    const parsed = JSON.parse(message.data);
    console.log(message.data);

    if (parsed.hasOwnProperty("meta")) {
      const message = parsed as MetaRecvType;
      const connected = message.meta === MetaEnum.connected;
      this.addChat(
        `Client ${message.sender_addr} ${connected ? "" : "dis"}connected`,
        message.sender_addr,
        "meta"
      );
      if (connected) {
        this.senderData[message.sender_addr] = { name: "" };
      } else {
        delete this.senderData[message.sender_addr];
      }
    } else if (parsed.hasOwnProperty("plaintext")) {
      const message = parsed as PlaintextRecvType;
      if (message.plaintext === "") {
        this.senderData[message.sender_addr] = { name: message.name };
      } else if (message.plaintext === "/start") {
        const pickRandomItems = <T extends unknown>(
          arr: T[],
          n: number
        ): T[] => {
          const shuffled = Array.from(arr).sort(() => 0.5 - Math.random());
          return shuffled.slice(0, n);
        };
        const members = Object.entries(this.senderData).map(
          ([senderAddr, { name }]) => name
        );
        const randomMember = pickRandomItems(members, 1);

        this.addChat(
          `Congratulations you fell out you became a santa: ${randomMember}`,
          message.sender_addr,
          "meta"
        );
        this.senderData[message.sender_addr] = { name: message.name };
      } else {
        this.addChat(message.plaintext, message.name, "plaintext");
      }
    } else {
      console.warn("Unexpected message", parsed);
    }

    this.setState({
      socketReadyState: this.socket.readyState,
    });
  };

  addChat = (
    content: React.ReactNode,
    senderAddr: string,
    type: ChatTypeType
  ) => {
    const date = new Date();
    const chat: ChatType = {
      content,
      date,
      senderAddr,
      showSenderAddr:
        this.lastSenderAddr !== senderAddr || this.lastType !== type,
      type,
    };

    this.lastDate = date;
    this.lastSenderAddr = chat.senderAddr;
    this.lastType = chat.type;

    this.setState({
      chats: this.state.chats.concat(chat),
    });
  };

  getConnectionStatus = () => {
    switch (this.state.socketReadyState) {
      case 0:
        return "Connecting";
      case 1:
        return "Connected";
      case 2:
        return "Closing";
      default:
        return "Closed";
    }
  };

  submitMessage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const input = this.state.input.trim();
    if (input) {
      const content: PlaintextSendType = {
        plaintext: input,
        name: this.state.newName,
      };
      this.send(content);
      this.addChat(input, "self", "plaintext");
      this.setState({ input: "" });
    }
  };

  newNameSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    this.send({ plaintext: "", name: this.state.newName });
  };

  newRoomSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const newRoomURI = encodeURIComponent(this.state.newRoom);

    this.props.history.push(newRoomURI);
  };

  render() {
    const connectionStatus = this.getConnectionStatus();
    const senderDataEntries = Object.entries(this.senderData);

    return (
      <div id="App">
        <div id="main">
          <div id="content">
            <div id="header">
              Santa Room:{" "}
              <span className="blob">{this.props.location.pathname}</span>{" "}
              <span className={`blob  ${connectionStatus}`}>
                {connectionStatus}
              </span>
            </div>

            <div id="chat-container">
              <div>
                {this.state.chats.map((m, i) => (
                  <Chat key={i} {...m} />
                ))}
              </div>
            </div>

            <div id="chat-form-container">
              <form id="chat-form" onSubmit={this.submitMessage}>
                <input
                  autoFocus
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    this.setState({ input: e.target.value })
                  }
                  placeholder="Some text"
                  value={this.state.input}
                />

                <button
                  type="submit"
                  disabled={this.state.socketReadyState !== 1}
                >
                  Send
                </button>
              </form>
            </div>
          </div>

          <div id="sidebar">
            <h2>Secret Santa Chat Room</h2>
            <p>Version {clientPackage.version}</p>
            <hr />
            <form id="new-room-form" onSubmit={this.newRoomSubmit}>
              <input
                id="new-room-input"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  this.setState({ newRoom: e.target.value })
                }
                placeholder="Pick a new room name"
                value={this.state.newRoom}
              />
              &nbsp;
              <button type="submit">
                Change Rooms
                <FontAwesomeIcon icon={faDoorOpen} />
              </button>
            </form>
            <form id="name" onSubmit={this.newNameSubmit}>
              <input
                id="new-room-input"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  this.setState({ newName: e.target.value })
                }
                placeholder="Press u name"
                value={this.state.newName}
              />
              &nbsp;
              <button type="submit">Set name</button>
            </form>
            <hr />
            <div>
              <h3>Connected Santas</h3>
              {senderDataEntries.length > 0 ? (
                senderDataEntries.map(([senderAddr, { name }]) => (
                  <DisplaySender senderAddr={senderAddr} name={name} />
                ))
              ) : (
                <div>No Santa's :'(</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default withRouter(App);
