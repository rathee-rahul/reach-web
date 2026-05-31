const LocalCache = (() => {
  const DB_NAME = "reach_web_cache";
  const DB_VERSION = 1;
  const CHAT_STORE = "chat_messages";
  const LIST_STORE = "chat_lists";
  const MAX_MESSAGES_PER_CHAT = 300;

  function key(parts) {
    return parts.map((part) => String(part || "")).join(":");
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("IndexedDB unavailable"));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(CHAT_STORE)) db.createObjectStore(CHAT_STORE, { keyPath: "id" });
        if (!db.objectStoreNames.contains(LIST_STORE)) db.createObjectStore(LIST_STORE, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Cache open failed"));
    });
  }

  async function getRecord(storeName, id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const request = tx.objectStore(storeName).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Cache read failed"));
      tx.oncomplete = () => db.close();
    });
  }

  async function putRecord(storeName, record) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(record);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error("Cache write failed"));
      };
    });
  }

  function normalizedMessages(messages) {
    return (messages || [])
      .map(Utils.normalizeMessage)
      .filter((message) => message.id)
      .sort((a, b) => new Date(a.sentAt || 0) - new Date(b.sentAt || 0))
      .slice(-MAX_MESSAGES_PER_CHAT);
  }

  return {
    async getMessages(ownerVid, chatId) {
      try {
        const record = await getRecord(CHAT_STORE, key([ownerVid, chatId]));
        return normalizedMessages(record?.messages || []);
      } catch {
        return [];
      }
    },

    async saveMessages(ownerVid, chatId, messages) {
      try {
        await putRecord(CHAT_STORE, {
          id: key([ownerVid, chatId]),
          ownerVid,
          chatId,
          messages: normalizedMessages(messages),
          updatedAt: new Date().toISOString(),
        });
      } catch {}
    },

    async clearMessages(ownerVid, chatId) {
      return this.saveMessages(ownerVid, chatId, []);
    },

    async getChatList(ownerVid) {
      try {
        const record = await getRecord(LIST_STORE, key([ownerVid, "chats"]));
        return Array.isArray(record?.contacts) ? record.contacts : [];
      } catch {
        return [];
      }
    },

    async saveChatList(ownerVid, contacts) {
      try {
        await putRecord(LIST_STORE, {
          id: key([ownerVid, "chats"]),
          ownerVid,
          contacts: Array.isArray(contacts) ? contacts : [],
          updatedAt: new Date().toISOString(),
        });
      } catch {}
    },

    async cleanOldChats(maxAgeDays = 30) {
      try {
        const db = await openDb();
        const cutoff = new Date(Date.now() - maxAgeDays * 86400000).toISOString();
        await new Promise((resolve) => {
          const tx = db.transaction(CHAT_STORE, "readwrite");
          const store = tx.objectStore(CHAT_STORE);
          const request = store.openCursor();
          request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (!cursor) return;
            if (cursor.value.updatedAt < cutoff) cursor.delete();
            cursor.continue();
          };
          tx.oncomplete = resolve;
          tx.onerror = resolve;
        });
        db.close();
      } catch {}
    },
  };
})();
