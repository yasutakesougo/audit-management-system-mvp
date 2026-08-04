/**
 * Public SharePoint feature surface for non-feature consumers.
 * Keep health-store internals behind this module boundary.
 */
export {
  _resetSpHealthSignalStore,
  getSpHealthSignal,
} from './health/spHealthSignalStore';
