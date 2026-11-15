import { SocialVerseProvider } from './context/SocialVerseContext';
import { AppShell } from './components/AppShell';

export default function App() {
  return (
    <SocialVerseProvider>
      <AppShell />
    </SocialVerseProvider>
  );
}
