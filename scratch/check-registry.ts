import { SP_LIST_REGISTRY } from '../src/sharepoint/spListRegistry';
console.log(SP_LIST_REGISTRY.map(e => ({ key: e.key, physical: e.resolve() })));
