export interface ReportLoadState<T> {
  selectionKey: string | null;
  requestId: number;
  loading: boolean;
  data: T | null;
}

export type ReportLoadAction<T> =
  | { type: "start"; selectionKey: string; requestId: number }
  | { type: "success"; selectionKey: string; requestId: number; data: T }
  | { type: "failure"; selectionKey: string; requestId: number };

export function initialReportLoadState<T>(): ReportLoadState<T> {
  return { selectionKey: null, requestId: 0, loading: true, data: null };
}

export function reduceReportLoadState<T>(
  state: ReportLoadState<T>,
  action: ReportLoadAction<T>,
): ReportLoadState<T> {
  if (action.type === "start") {
    return {
      selectionKey: action.selectionKey,
      requestId: action.requestId,
      loading: true,
      data: null,
    };
  }

  if (state.selectionKey !== action.selectionKey || state.requestId !== action.requestId) {
    return state;
  }

  if (action.type === "failure") {
    return { ...state, loading: false, data: null };
  }

  return { ...state, loading: false, data: action.data };
}

export function isReportViewReady<T>(
  state: ReportLoadState<T>,
  categoriesLoading: boolean,
): state is ReportLoadState<T> & { data: T } {
  return !state.loading && !categoriesLoading && state.data !== null;
}
