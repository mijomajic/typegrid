import { TypeGrid } from '@/components/typegrid';
import { notFound } from 'next/navigation';
export default async function Page({params}:{params:Promise<{page:string[]}>}){const {page}=await params;if(!['dashboard','leaderboard','achievements','integrations','settings','connect','privacy','u'].includes(page[0]))notFound();return <TypeGrid page={page[0]} username={page[1]}/>}
