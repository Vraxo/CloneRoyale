import type { Container } from "pixi.js";

export interface EntityView<T> {
  readonly id: number;
  readonly container: Container;
  update(entity: T, time?: number): void;
  destroy(): void;
}

export function synchronizeViews<T extends { id: number }, V extends EntityView<T>>(
  entities: T[],
  views: Map<number, V>,
  layer: Container,
  create: (entity: T) => V,
  update: (view: V, entity: T) => void,
  depth: (entity: T) => number
): void {
  const activeIds = new Set<number>();

  for (const entity of entities) {
    activeIds.add(entity.id);

    let view = views.get(entity.id);
    if (!view) {
      view = create(entity);
      views.set(entity.id, view);
      layer.addChild(view.container);
    }

    update(view, entity);
    view.container.zIndex = depth(entity);
  }

  for (const [id, view] of views) {
    if (activeIds.has(id)) continue;

    views.delete(id);
    view.destroy();
  }
}
