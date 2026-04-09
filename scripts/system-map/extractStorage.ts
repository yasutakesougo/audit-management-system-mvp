import * as fs from 'node:fs';
import * as path from 'node:path';
import { StorageRef } from './types';

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    if (fs.statSync(filepath).isDirectory()) {
      getAllFiles(filepath, fileList);
    } else if (/\.(ts|tsx)$/.test(filepath)) {
      fileList.push(filepath);
    }
  }
  return fileList;
}

export function extractStorage(srcRoot: string, feature: string): StorageRef[] {
  const featureDir = path.join(srcRoot, 'features', feature);
  const files = getAllFiles(featureDir);
  
  let usesSP = false;
  let usesLocalStorage = false;
  let usesFirestore = false;
  let usesZustand = false;
  let usesMsal = false;
  
  const spKeys = new Set<string>();

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    
    // SharePoint
    if (/spFetch|useSP|spListRegistry|getListItems|@\/lib\/sp|SharePoint/i.test(content)) {
      usesSP = true;
    }
    
    // Extract ListKeys enumerations natively mapped to spListRegistry
    // e.g. ListKeys.UsersMaster
    const listKeyMatches = content.match(/ListKeys\.([a-zA-Z0-9_]+)/g);
    if (listKeyMatches) {
        listKeyMatches.forEach(m => spKeys.add(m.replace('ListKeys.', '')));
    }

    // Direct SP List Registry Keys extraction via known ENV var tokens
    const envMatches = content.match(/VITE_SP_LIST_[A-Z_]+/g);
    if (envMatches) envMatches.forEach(m => spKeys.add(m));

    // LocalStorage
    if (/localStorage|window\.localStorage|createJSONStorage/i.test(content)) {
      usesLocalStorage = true;
    }
    
    // Firestore
    if (/@firebase|firestore|collection\(|doc\(/i.test(content)) {
      usesFirestore = true;
    }
    
    // Zustand
    if (/zustand/i.test(content)) {
      usesZustand = true;
    }

    // MSAL
    if (/useMsal|getActiveAccount/i.test(content)) {
      usesMsal = true;
    }
  }

  const results: StorageRef[] = [];
  if (usesSP) {
    results.push({
      kind: 'sharepoint',
      listKeys: Array.from(spKeys),
      access: ['R', 'W'] // TODO: extract exact R/W operations statically if possible
    });
  }
  
  if (usesLocalStorage) results.push({ kind: 'localStorage' });
  if (usesFirestore) results.push({ kind: 'firestore' });
  if (usesZustand) results.push({ kind: 'zustand' });
  if (usesMsal) results.push({ kind: 'msal' });
  
  if (results.length === 0) {
    // Check if there are mainly utility functions
    results.push({ kind: 'pure-function' });
  }

  return results;
}
