import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import ChatPanel from './ChatPanel';
import { useState } from 'react';
import styles from './Layout.module.css';

export default function Layout() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className={styles.layout}>
      <Navbar onChatToggle={() => setChatOpen(o => !o)} chatOpen={chatOpen} />
      <div className={styles.body}>
        <Sidebar />
        <main className={styles.main}>
          <Outlet />
        </main>
        <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
      </div>
    </div>
  );
}
