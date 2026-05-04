type VisibilityCallback = (entry: IntersectionObserverEntry) => void;

interface VisibilityCallbacks {
  onEnter?: VisibilityCallback;
  onLeave?: VisibilityCallback;
  once?: boolean;
}

export function observeVisibility(
  element: Element,
  { onEnter, onLeave, once = false }: VisibilityCallbacks,
  options: IntersectionObserverInit = { rootMargin: "200px" },
): () => void {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        onEnter?.(entry);
        if (once) {
          observer.disconnect();
          return;
        }
      } else {
        onLeave?.(entry);
      }
    }
  }, options);

  observer.observe(element);
  return () => observer.disconnect();
}
