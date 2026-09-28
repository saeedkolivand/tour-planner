/** What the Live Activity and the widget show. Plain data: it crosses into the widget runtime. */
export interface NextStopProps {
  /** Loading number of the stop the van parks at; 0 when the tour is complete. */
  no: number;
  /** "Venloer Str. 211" */
  address: string;
  postcode: string;
  /** Stops walked to from the same parking spot. */
  walk: number;
  /** Express deadline like "12:00", else "". */
  express: string;
  /** 'private' | 'business' | 'pickup' | 'shop' */
  type: string;
  /** Parking stops left, including this one. */
  left: number;
  delivered: number;
  total: number;
  /** Arrival estimate "HH:MM" and the same as epoch ms (for self-updating relative text), 0 when unknown. */
  eta: string;
  etaMs: number;

  // Pre-translated strings: the layout functions below are serialized into expo-widgets' runtime and may only
  // use their props + @expo/ui (no imports), so nextStopProps.ts resolves every word via i18n before crossing over.
  /** "Tour complete" */
  doneLabel: string;
  /** "Next stop" */
  nextLabel: string;
  /** "Done" (compact widget header) */
  widgetDoneLabel: string;
  /** "Next" (compact widget header) */
  widgetNextLabel: string;
  /** "All stops delivered" (widget's completed-state address line) */
  widgetDoneAddress: string;
  /** "{n} parking stop(s) left", '' when done */
  leftPhrase: string;
  /** "{n} left", '' when done */
  leftShort: string;
  /** "{delivered} of {total} delivered" */
  deliveredOfTotal: string;
  /** "+{n} on foot", '' when walk is 0 */
  onFootPhrase: string;
  /** "Express {value}", '' when no express deadline */
  expressPhrase: string;
  /** "arrive" */
  arriveLabel: string;
}
