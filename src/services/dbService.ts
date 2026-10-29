import { HistoryItem, PromptTemplate, StorageStats } from "../types";
import { supabase } from "../lib/supabase";

const DB_NAME = 'YingjiaDB';
const DB_VERSION = 2;
const STORE_HISTORY = 'history';
const STORE_TEMPLATES = 'templates';
const STORE_APP_DATA = 'app_data';

// 5GB in Bytes
export const MAX_STORAGE_BYTES = 5 * 1024 * 1024 * 1024; 

/* 
 * SQL Helper for Supabase Table `system_prompts`
 * 请在 Supabase SQL Editor 中运行此脚本，创建全局预设库：
 *
 * CREATE TABLE IF NOT EXISTS public.system_prompts (
 *   id TEXT PRIMARY KEY,
 *   name TEXT NOT NULL,
 *   content TEXT NOT NULL,
 *   role TEXT,
 *   timestamp BIGINT NOT NULL
 * );
 *
 * -- 开启RLS保护
 * ALTER TABLE public.system_prompts ENABLE ROW LEVEL SECURITY;
 * 
 * -- 允许任何人读取全局系统指令
 * CREATE POLICY "Allow public read-access to system prompts" 
 *   ON public.system_prompts FOR SELECT 
 *   USING (true);
 *
 * -- 允许鉴权用户写入（你可以修改为仅限特定管理员邮箱等）
 * CREATE POLICY "Allow authenticated users to insert system prompts" 
 *   ON public.system_prompts FOR INSERT 
 *   WITH CHECK (auth.role() = 'authenticated');
 * 
 * CREATE POLICY "Allow authenticated users to update system prompts" 
 *   ON public.system_prompts FOR UPDATE 
 *   USING (auth.role() = 'authenticated');
 *
 * CREATE POLICY "Allow authenticated users to delete system prompts" 
 *   ON public.system_prompts FOR DELETE 
 *   USING (auth.role() = 'authenticated');
 */

class DBService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject("Error opening database");

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_HISTORY)) {
          const store = db.createObjectStore(STORE_HISTORY, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_TEMPLATES)) {
          db.createObjectStore(STORE_TEMPLATES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_APP_DATA)) {
          db.createObjectStore(STORE_APP_DATA, { keyPath: 'key' });
        }
      };
    });
  }

  // Helper to calculate string size in bytes (approximate for base64)
  private calculateSize(str: string): number {
    return new Blob([str]).size;
  }

  // --- History Methods ---

  async saveToHistory(item: Omit<HistoryItem, 'size'>): Promise<void> {
    await this.init();
    const size = this.calculateSize(item.imageUrl) + this.calculateSize(item.prompt);
    const fullItem: HistoryItem = { ...item, size };

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_HISTORY, 'readwrite');
      const store = tx.objectStore(STORE_HISTORY);
      store.add(fullItem);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject("Failed to save to history");
    });
  }

  async getHistory(): Promise<HistoryItem[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_HISTORY, 'readonly');
      const store = tx.objectStore(STORE_HISTORY);
      const index = store.index('timestamp');
      // Get all, but typically you'd want pagination. For now, getting all is fine for a few GB locally.
      // We reverse direction to show newest first
      const request = index.openCursor(null, 'prev');
      const results: HistoryItem[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject("Failed to fetch history");
    });
  }

  async deleteHistoryItem(id: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_HISTORY, 'readwrite');
      const store = tx.objectStore(STORE_HISTORY);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject("Failed to delete item");
    });
  }

  async deleteHistoryItems(ids: string[]): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_HISTORY, 'readwrite');
      const store = tx.objectStore(STORE_HISTORY);
      
      ids.forEach(id => {
          store.delete(id);
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject("Failed to delete items");
    });
  }

  async clearHistory(): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_HISTORY, 'readwrite');
      const store = tx.objectStore(STORE_HISTORY);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject("Failed to clear history");
    });
  }

  // --- Template Methods ---

  async syncTemplates(templates: PromptTemplate[]): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const uniqueTemplates = Array.from(new Map(templates.map(item => [item.id, item])).values());
        
        await supabase.auth.updateUser({
           data: { prompt_templates: uniqueTemplates }
        });
        return;
      }
    } catch (e) {
      console.warn("Failed to sync to Supabase user_metadata, failing back to local.", e);
    }

    await this.init();
    return new Promise((resolve, reject) => {
        const tx = this.db!.transaction(STORE_TEMPLATES, 'readwrite');
        const store = tx.objectStore(STORE_TEMPLATES);
        templates.forEach(t => store.put(t));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject("Failed to sync templates");
    });
  }

  async saveTemplate(template: PromptTemplate): Promise<void> {
    if (template.id.startsWith('p')) {
      try {
        const { error } = await supabase.from('system_prompts').upsert(template);
        if (error) console.warn("Failed to update system prompt. Requires admin privileges or table does not exist:", error);
      } catch (e) {
        console.warn("Exception updating system prompt:", e);
      }
      return; // Do not save system prompts into personal local storage
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const metadata = user.user_metadata || {};
        const templates: PromptTemplate[] = metadata.prompt_templates || [];
        const index = templates.findIndex(t => t.id === template.id);
        
        if (index > -1) {
           templates[index] = template;
        } else {
           templates.push(template);
        }
        
        // Remove duplicates if any logic created them
        const uniqueTemplates = Array.from(new Map(templates.map(item => [item.id, item])).values());
        
        await supabase.auth.updateUser({
           data: { prompt_templates: uniqueTemplates }
        });
        return;
      }
    } catch (e) {
      console.warn("Failed to save to Supabase user_metadata, failing back to local.", e);
    }

    await this.init();
    return new Promise((resolve, reject) => {
        const tx = this.db!.transaction(STORE_TEMPLATES, 'readwrite');
        const store = tx.objectStore(STORE_TEMPLATES);
        store.put(template); // put allows update if id exists
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject("Failed to save template");
    });
  }

  async getSystemTemplatesFromDB(): Promise<PromptTemplate[]> {
    try {
      const { data, error } = await supabase
        .from('system_prompts')
        .select('*')
        .order('id', { ascending: true }); // p0, p1 etc

      if (!error && data && data.length > 0) {
        return data as PromptTemplate[];
      }
    } catch (e) {
      console.warn("Error fetching system templates from DB", e);
    }
    return [];
  }

  async getTemplates(): Promise<PromptTemplate[]> {
    let personalTemplates: PromptTemplate[] = [];
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.user_metadata?.prompt_templates) {
         personalTemplates = user.user_metadata.prompt_templates;
      }
    } catch (e) {
      console.warn("Failed to fetch templates from Supabase, falling back to local.", e);
    }

    if (personalTemplates.length === 0) {
      await this.init();
      personalTemplates = await new Promise((resolve, reject) => {
          const tx = this.db!.transaction(STORE_TEMPLATES, 'readonly');
          const store = tx.objectStore(STORE_TEMPLATES);
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result || []);
          request.onerror = () => reject("Failed to fetch templates");
      });
    }

    // Now get system templates
    let systemTemplates = await this.getSystemTemplatesFromDB();

    // Remove duplicates from personal that match system IDs (just in case they got blended previously)
    const systemIds = new Set(systemTemplates.map(t => t.id));
    personalTemplates = personalTemplates.filter(t => !systemIds.has(t.id) && !t.id.startsWith('p'));

    return [...systemTemplates, ...personalTemplates];
  }

  async deleteTemplate(id: string): Promise<void> {
    if (id.startsWith('p')) {
      try {
        const { error } = await supabase.from('system_prompts').delete().eq('id', id);
        if (error) console.warn("Failed to delete system prompt. Requires admin privileges or table does not exist:", error);
      } catch (e) {
        console.warn("Exception deleting system prompt:", e);
      }
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const metadata = user.user_metadata || {};
        const templates: PromptTemplate[] = metadata.prompt_templates || [];
        const filteredTemplates = templates.filter(t => t.id !== id);
        
        await supabase.auth.updateUser({
           data: { prompt_templates: filteredTemplates }
        });
        return;
      }
    } catch (e) {
      console.warn("Failed to delete from Supabase, falling back to local.", e);
    }

    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_TEMPLATES, 'readwrite');
      const store = tx.objectStore(STORE_TEMPLATES);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject("Failed to delete template");
    });
  }


  // --- App Data (Long-term 5GB storage for custom assets) ---
  async saveAppData(key: string, data: any): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_APP_DATA, 'readwrite');
      const store = tx.objectStore(STORE_APP_DATA);
      store.put({ key, data });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject("Failed to save app data");
    });
  }

  async getAppData(key: string): Promise<any | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_APP_DATA, 'readonly');
      const store = tx.objectStore(STORE_APP_DATA);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.data || null);
      request.onerror = () => resolve(null);
    });
  }

  // --- Stats ---

  async getStorageStats(): Promise<StorageStats> {
    await this.init();
    const history = await this.getHistory();
    let totalBytes = 0;
    history.forEach(item => totalBytes += item.size);
    return {
      usedBytes: totalBytes,
      fileCount: history.length
    };
  }
}

export const dbService = new DBService();