export type PublicKeySendType = {
  public_key: JsonWebKey;
};

export type PlaintextSendType = {
  plaintext: string;
  name: string;
};

export type RecvType = {
  sender_addr: string;
};

export enum MetaEnum {
  connected = 0,
  disconnected,
}

export type MetaRecvType = RecvType & {
  meta: MetaEnum;
  name: string;
};

export type PlaintextRecvType = RecvType & {
  plaintext: string;
  name: string;
};

export type PublicKeyRecvType = RecvType & {
  public_key: JsonWebKey;
};
export type Name = {
  name: string;
};
export type InfoUser = RecvType & Name;
