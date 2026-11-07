import type { Metadata } from 'next';
import { AppProvider } from '@/components/app-provider';
import { I18nProvider } from '@/components/i18n';
import { Shell } from '@/components/shell';
import './globals.css';
export const metadata:Metadata={title:'心遇 · 让相遇，发生在此刻',description:'有主持人的真诚视频相亲。初次心动、深入了解、双向奔赴，让相遇慢慢发生。'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body><I18nProvider><AppProvider><Shell>{children}</Shell></AppProvider></I18nProvider></body></html>;}
