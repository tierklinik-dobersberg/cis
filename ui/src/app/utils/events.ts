export function getClientX(
  event: MouseEvent | HammerInput
): number | null {
  if (event instanceof MouseEvent) {
    return event.clientX;
  }

  var clientX: number | null = null;

  if (event.srcEvent instanceof MouseEvent) {
    clientX = event.srcEvent.clientX;
  } else if (
    event.srcEvent instanceof TouchEvent &&
    event.srcEvent.touches.length === 1
  ) {
    clientX = event.srcEvent.touches[0].clientX;
  } else if (event.srcEvent instanceof PointerEvent) {
    clientX = event.srcEvent.clientX;
  }

  return clientX;
}

export function getClientY(
  event: MouseEvent | HammerInput
): number | null {
  if (event instanceof MouseEvent) {
    return event.clientY;
  }

  var clientY: number | null = null;

  if (event.srcEvent instanceof MouseEvent) {
    clientY = event.srcEvent.clientY;
  } else if (
    event.srcEvent instanceof TouchEvent &&
    event.srcEvent.touches.length === 1
  ) {
    clientY = event.srcEvent.touches[0].clientY;
  } else if (event.srcEvent instanceof PointerEvent) {
    clientY = event.srcEvent.clientY;
  }

  return clientY;
}
