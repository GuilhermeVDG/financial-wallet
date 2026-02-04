import { WalletEvent } from './wallet-events.enum';

export interface WalletEventPayload {
  event: WalletEvent;
  timestamp: string;
  data: Record<string, unknown>;
}
