import { useCallback, useRef, useState } from "react";

export interface HistoryState {
  content: string;
  title: string;
  html?: string;
}

export function useUndoRedo(initialState: HistoryState) {
  const [state, setState] = useState<HistoryState>(initialState);
  const historyRef = useRef<HistoryState[]>([initialState]);
  const historyIndexRef = useRef(0);

  const push = useCallback((newState: HistoryState) => {
    // Remove any future history if we're not at the end
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(newState);
    historyIndexRef.current = historyRef.current.length - 1;
    setState(newState);
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const previous = historyRef.current[historyIndexRef.current];
      setState(previous);
      return previous;
    }
    return state;
  }, [state]);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      const next = historyRef.current[historyIndexRef.current];
      setState(next);
      return next;
    }
    return state;
  }, [state]);

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  return { state, setState: push, undo, redo, canUndo, canRedo };
}
