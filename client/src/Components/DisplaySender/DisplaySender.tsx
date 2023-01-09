import "./displaySender.scss";
type Props = {
  senderAddr: string;
  name: string;
};

const DisplaySender = (props: Props) => {
  const { senderAddr, name } = props;
  const renderName = name === "" ? senderAddr : name;
  return (
    <div className="displaySender blob">
      <div>{renderName}</div>
    </div>
  );
};

export default DisplaySender;
