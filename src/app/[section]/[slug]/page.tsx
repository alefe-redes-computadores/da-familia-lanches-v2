import type { Metadata } from "next";
import { products } from "@/data/products";
import { ProductPublicPage } from "@/components/product/ProductPublicPage";
import { matchesProductRoute } from "@/lib/productRoutes";

type Props = { params: Promise<{ section: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section, slug } = await params;
  const product = products.find((item) => matchesProductRoute(item, section, slug));
  if (!product) return { title: "Cardápio", description: "Conheça o cardápio da Da Família Lanches." };
  return {
    title: product.name,
    description: `${product.description} Peça pelo site da Da Família Lanches.`,
    alternates: { canonical: `https://dafamilialanches.com.br/${section}/${slug}` },
    openGraph: { title: `${product.name} | Da Família Lanches`, description: product.description, url: `https://dafamilialanches.com.br/${section}/${slug}`, images: [{ url: product.image }] },
  };
}

export default async function ProductRoute({ params }: Props) {
  const { section, slug } = await params;
  return <ProductPublicPage section={section} slug={slug} />;
}
