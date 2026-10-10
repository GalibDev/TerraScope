import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export function GET(){return NextResponse.json({status:'ok',release:'analysis-v2',revision:process.env.VERCEL_GIT_COMMIT_SHA||null},{headers:{'Cache-Control':'no-store'}});}
