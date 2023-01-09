import React, { useMemo } from "react";

import "./chat.scss";

export type ChatType = {
  content: React.ReactNode;
  date: Date;
  senderAddr: string;
  showSenderAddr: boolean;
  type: string;
};

export type ChatTypeType = "meta" | "plaintext" | "self";

const Chat = (props: ChatType) => {
  const { content, senderAddr, showSenderAddr, type } = props;

  const renderSenderAddr = showSenderAddr ? (
    <div className="sender">{senderAddr === "self" ? "You" : senderAddr }</div>
  ) : null;

  const renderContent = useMemo(() => {
    return <pre className="chatPre">{content}</pre>;
  }, [content, senderAddr, type ]);

  if (content) {
    return (
      <div className="message-container">
        <div className={`message ${senderAddr} ${type}`}>
          <div>
            {renderSenderAddr}
            <div
              style={{
                alignItems: "center",
                display: "flex",
                flexDirection: senderAddr === "self" ? "row-reverse" : "row",
              }}
            >
              <span className="content">{renderContent}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default Chat;
