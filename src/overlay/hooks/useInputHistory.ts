import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

type InputHistoryOptions = {
  history: string[];
  value: string;
  setValue: (value: string) => void;
};

export function useInputHistory({
  history,
  value,
  setValue,
}: InputHistoryOptions) {
  const [index, setIndex] = useState(-1);
  const draftRef = useRef("");
  const historyRef = useRef(history);
  const historyLengthRef = useRef(history.length);
  const indexRef = useRef(index);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    historyRef.current = history;
    if (history.length !== historyLengthRef.current) {
      historyLengthRef.current = history.length;
      setIndex(-1);
    }
  }, [history]);

  const resetHistory = useCallback(() => {
    setIndex(-1);
  }, []);

  const handleHistoryKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return false;
      if (event.ctrlKey || event.metaKey || event.altKey) return false;

      const input = event.currentTarget;
      const selectionStart = input.selectionStart ?? 0;
      const selectionEnd = input.selectionEnd ?? 0;
      const atStart = selectionStart === 0 && selectionEnd === 0;
      const atEnd = selectionStart === value.length && selectionEnd === value.length;

      if (event.key === "ArrowUp" && !atStart) return false;
      if (event.key === "ArrowDown" && !atEnd) return false;

      const entries = historyRef.current;
      if (!entries.length) return false;

      event.preventDefault();
      const prevIndex = indexRef.current;
      if (prevIndex === -1) {
        draftRef.current = value;
      }
      const nextIndex =
        event.key === "ArrowUp"
          ? Math.min(prevIndex + 1, entries.length - 1)
          : Math.max(prevIndex - 1, -1);
      const nextValue =
        nextIndex === -1
          ? draftRef.current
          : entries[entries.length - 1 - nextIndex];
      setIndex(nextIndex);
      setValue(nextValue);

      return true;
    },
    [value, setValue],
  );

  return {
    handleHistoryKeyDown,
    resetHistory,
    isNavigating: index !== -1,
  };
}
