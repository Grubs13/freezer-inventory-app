import { ItemDetail } from './ItemDetail';

export default async function ItemPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  return <ItemDetail itemId={itemId} />;
}
