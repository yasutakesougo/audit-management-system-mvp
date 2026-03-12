/**
 * MUI ↔ react-router-dom link type adapter.
 *
 * MUI's `component` prop expects `React.ElementType`, but react-router-dom's
 * `Link` component signature is incompatible. This adapter centralises the
 * single `as unknown as` cast so call sites stay type-assertion-free.
 *
 * Usage:
 *   <Button component={MuiRouterLink} to="/path">Go</Button>
 *   <ListItemButton component={MuiRouterLink} to="/path">Go</ListItemButton>
 */
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';

/**
 * React Router's `Link` pre-cast to `React.ElementType` for MUI `component` prop.
 *
 * This is the only place where the `as unknown as` assertion lives.
 * All call sites should import this instead of writing their own cast.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MuiRouterLink = RouterLink as unknown as React.ElementType;

/**
 * Same adapter for any link-like component (e.g. NavLinkPrefetch).
 * Use when the link component is dynamic or wraps RouterLink.
 */
export function asMuiComponent<T>(component: T): React.ElementType {
  return component as unknown as React.ElementType;
}
