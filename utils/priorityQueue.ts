/**
 * @file priorityQueue.ts
 * @description Simple binary min heap implementation used for pathfinding.
 */

export interface HeapItem<T> {
  value: T;
  priority: number;
}

export interface MinHeap<T> {
  push(value: T, priority: number): void;
  pop(): T | undefined;
  size(): number;
}

export const createMinHeap = <T>(): MinHeap<T> => {
  const heap: Array<HeapItem<T>> = [];

  const swap = (i: number, j: number) => {
    const temp = heap[i];
    heap[i] = heap[j];
    heap[j] = temp;
  };

  const bubbleUp = (index: number) => {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (heap[parent].priority <= heap[index].priority) break;
      swap(parent, index);
      index = parent;
    }
  };

  const bubbleDown = (index: number) => {
    const lastIndex = heap.length - 1;
    for (;;) {
      const left = index * 2 + 1;
      const right = index * 2 + 2;
      let smallest = index;

      if (left <= lastIndex && heap[left].priority < heap[smallest].priority) {
        smallest = left;
      }
      if (right <= lastIndex && heap[right].priority < heap[smallest].priority) {
        smallest = right;
      }
      if (smallest === index) break;
      swap(index, smallest);
      index = smallest;
    }
  };

  return {
    push(value: T, priority: number) {
      heap.push({ value, priority });
      bubbleUp(heap.length - 1);
    },
    pop(): T | undefined {
      if (heap.length === 0) return undefined;
      const top = heap[0].value;
      const last = heap.pop();
      if (last !== undefined && heap.length > 0) {
        heap[0] = last;
        bubbleDown(0);
      }
      return top;
    },
    size() {
      return heap.length;
    },
  };
};
