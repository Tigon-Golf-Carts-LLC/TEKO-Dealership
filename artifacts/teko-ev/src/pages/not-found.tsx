import { Link } from 'wouter';
import { AlertCircle, ArrowRight } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="grid min-h-screen w-full place-items-center bg-[#f7fbff] px-5">
      <div className="glass w-full max-w-md rounded-[1.5rem] p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#e23a3a] text-white">
          <AlertCircle size={22} />
        </div>
        <h1 className="mt-7 font-display text-5xl font-semibold tracking-[-.05em] text-[#082a66]">
          Page not found
        </h1>
        <p className="mt-5 leading-7 text-[#52709f]">
          That page has moved or never existed. The collection, dealer network,
          and financing options are all still a click away.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="cta-primary inline-flex items-center gap-3 rounded-full px-5 py-3.5 text-[11px] font-bold uppercase tracking-[.1em]"
            data-testid="link-notfound-home"
          >
            Back to home <ArrowRight size={14} />
          </Link>
          <Link
            href="/models"
            className="cta-outline inline-flex items-center gap-3 rounded-full border px-5 py-3.5 text-[11px] font-bold uppercase tracking-[.1em] text-[#1769ff]"
            data-testid="link-notfound-models"
          >
            View the models
          </Link>
        </div>
      </div>
    </main>
  );
}
