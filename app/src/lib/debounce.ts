export function debounce(fn: () => void, waitMs: number): { call: () => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    call() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn();
      }, waitMs);
    },
    cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
