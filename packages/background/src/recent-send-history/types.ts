import { AppCurrency } from "@keplr-wallet/types";

export interface RecentSendHistory {
  timestamp: number;
  sender: string;
  recipient: string;
  amount: {
    amount: string;
    denom: string;
  }[];
  memo: string;

  ibcChannels:
    | {
        portId: string;
        channelId: string;
        counterpartyChainId: string;
      }[]
    | undefined;
}

export type IBCHistory = {
  id: string;
  chainId: string;
  destinationChainId: string;
  timestamp: number;
  sender: string;

  amount: {
    amount: string;
    denom: string;
  }[];
  memo: string;

  txHash: string;

  txFulfilled?: boolean;
  txError?: string;

  ibcHistory:
    | {
        portId: string;
        channelId: string;
        counterpartyChainId: string;

        sequence?: string;

        completed: boolean;
        error?: string;
        rewound?: boolean;
        // swap 이후에는 rewind가 불가능하기 때문에
        // swap 등에서는 이 값이 true일 수 있음
        rewoundButNextRewindingBlocked?: boolean;
      }[];

  // Already notified to user
  notified?: boolean;
  notificationInfo?: {
    currencies: AppCurrency[];
  };
} & (IBCTransferHistory | IBCSwapHistory);

export interface IBCTransferHistory {
  recipient: string;
}

export interface IBCSwapHistory {
  swapType: "amount-in" | "amount-out";
  swapChannelIndex: number;
  swapReceiver: string[];

  destinationAsset: {
    chainId: string;
    denom: string;
  };

  resAmount: {
    amount: string;
    denom: string;
  }[][];

  swapRefundInfo?: {
    chainId: string;
    amount: {
      amount: string;
      denom: string;
    }[];
  };
}
