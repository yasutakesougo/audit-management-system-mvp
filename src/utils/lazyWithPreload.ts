import React from 'react';

type PreloadableComponent<TProps> = React.LazyExoticComponent<React.ComponentType<TProps>> & {
  preload?: () => Promise<unknown>;
};

export default function lazyWithPreload<TProps = unknown>(
  factory: () => Promise<{ default: React.ComponentType<TProps> }>,
): PreloadableComponent<TProps> {
  const Component = React.lazy(factory) as PreloadableComponent<TProps>;
  Component.preload = factory;
  return Component;
}
