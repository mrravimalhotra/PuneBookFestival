/** Shared between the scanner page, its offline queue, the SW and the API. */
export type CheckinRequestItem = {
  clientRef: string;
  token?: string;
  attendeeId?: string;
  scannedAt: string;
};

export type CheckinResultItem = {
  clientRef: string;
  status: 'checked_in' | 'already' | 'invalid' | 'not_found' | 'error';
  /** true when retrying cannot change the outcome (remove from the queue). */
  final: boolean;
  name?: string;
  checkinAt?: string;
  checkinDate?: string;
};
