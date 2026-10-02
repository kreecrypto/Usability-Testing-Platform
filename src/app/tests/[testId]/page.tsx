import TestOverview from './test-overview-client';
export default async function Page({params}:{params:Promise<{testId:string}>}) {return <TestOverview testId={(await params).testId}/>;}
