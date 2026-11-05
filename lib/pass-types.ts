/** Serializable pass snapshot: rendered online, downloaded, and cached offline. */
export type PassSnapshot = {
  token: string;
  url: string;
  fullName: string;
  passCode: string;
  dates: string[];
  festivalName: string;
  festivalYear: number;
  venue: string;
  startDate: string;
  endDate: string;
  openTime: string;
  closeTime: string;
  qrDataUrl: string;
  sponsors: Array<{ id: string; name: string; logoUrl: string }>;
  savedAt?: string;
};
