import Navbar from "@/components/thunai/Navbar";
import Hero from "@/components/thunai/Hero";
import Crossing from "@/components/thunai/Crossing";
import MobileApp from "@/components/thunai/MobileApp";
import Safeguards from "@/components/thunai/Safeguards";
import FAQ from "@/components/thunai/FAQ";
import Footer from "@/components/thunai/Footer";

export default function Home() {
  return (
    <main className="flex w-full flex-col bg-white">
      <Navbar />
      <Hero />
      <Crossing />
      <MobileApp />
      <Safeguards />
      <FAQ />
      <Footer />
    </main>
  );
}
