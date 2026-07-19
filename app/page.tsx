import type { Metadata } from 'next';
import Image from 'next/image';
import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRightIcon,
  Building2Icon,
  CheckCircle2Icon,
  KeyRoundIcon,
  MailIcon,
  MapPinIcon,
  ShieldCheckIcon,
  StoreIcon,
  WindIcon,
} from 'lucide-react';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '8TURF Properties | Apartments & Commercial Spaces',
  description:
    'Discover practical apartments and commercial rental spaces in convenient Tuguegarao City locations.',
};

const apartmentFeatures = [
  {
    icon: MapPinIcon,
    title: 'Convenient location',
    description: 'Near schools, offices, transport routes, and essential services.',
  },
  {
    icon: WindIcon,
    title: 'Breezy common areas',
    description: 'Open corridors support natural airflow and a brighter environment.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Secure entrances',
    description: 'Individual access doors and protected common spaces.',
  },
  {
    icon: KeyRoundIcon,
    title: 'Practical rental setup',
    description: 'Designed for students, professionals, couples, and small families.',
  },
];

const commercialFeatures = [
  {
    icon: StoreIcon,
    title: 'Street-facing frontage',
    description: 'Visible spaces for walk-in customers and nearby residents.',
  },
  {
    icon: Building2Icon,
    title: 'Flexible business use',
    description: 'Suitable for retail, office, personal services, and similar operations.',
  },
  {
    icon: KeyRoundIcon,
    title: 'Separate access',
    description: 'Dedicated entryways help tenants manage their space independently.',
  },
  {
    icon: MapPinIcon,
    title: 'Established neighborhood',
    description: 'Positioned within an active local community and roadside setting.',
  },
];

const apartmentImages = [
  {
    src: '/properties/apartments-exterior.webp',
    alt: 'Yellow and charcoal exterior of 8TURF Apartments',
  },
  {
    src: '/properties/apartments-corridor.webp',
    alt: 'Bright open-air corridor at 8TURF Apartments',
  },
  {
    src: '/properties/apartments-location.webp',
    alt: '8TURF Apartments building with Vista Del Rio location details',
  },
];

const commercialImages = [
  {
    src: '/properties/commercial-exterior.webp',
    alt: 'Street-facing exterior of 8TURF Commercial',
  },
  {
    src: '/properties/commercial-corridor.webp',
    alt: 'Covered corridor and entrances at 8TURF Commercial',
  },
  {
    src: '/properties/commercial-entrance.webp',
    alt: 'Secure entrance to an 8TURF Commercial rental space',
  },
];

function PropertyGallery({
  images,
  label,
}: {
  images: typeof apartmentImages;
  label: string;
}) {
  return (
    <div
      className='grid grid-cols-2 gap-2.5 sm:gap-3'
      role='group'
      aria-label={`${label} photo gallery`}
    >
      {images.map((image, index) => (
        <figure
          key={image.src}
          className={
            index === 0
              ? 'relative col-span-2 aspect-[16/10] overflow-hidden rounded-2xl bg-muted'
              : 'relative aspect-square overflow-hidden rounded-2xl bg-muted sm:aspect-[4/3]'
          }
        >
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes={
              index === 0
                ? '(max-width: 1024px) 100vw, 50vw'
                : '(max-width: 640px) 50vw, (max-width: 1024px) 45vw, 25vw'
            }
            className='object-cover transition-transform duration-500 hover:scale-[1.025]'
          />
        </figure>
      ))}
    </div>
  );
}

function FeatureGrid({ features }: { features: typeof apartmentFeatures }) {
  return (
    <div className='grid gap-5 sm:grid-cols-2'>
      {features.map((feature) => {
        const Icon = feature.icon;
        return (
          <div key={feature.title} className='flex gap-3.5'>
            <span className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-success-muted text-primary'>
              <Icon className='size-5' aria-hidden />
            </span>
            <div>
              <h3 className='font-heading text-base font-semibold'>{feature.title}</h3>
              <p className='mt-1 text-sm leading-6 text-muted-foreground'>
                {feature.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) {
    redirect('/dashboard');
  }

  return (
    <main className='overflow-x-clip'>
      <section className='relative isolate overflow-hidden border-b border-border' id='top'>
        <div
          className='absolute inset-0 -z-20 bg-[radial-gradient(circle_at_12%_15%,var(--success-muted),transparent_38%),linear-gradient(180deg,var(--background),var(--muted))]'
          aria-hidden
        />
        <div className='mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16 lg:px-8 lg:py-24'>
          <div className='max-w-2xl'>
            <p className='mb-5 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-success-muted px-3 py-1.5 text-xs font-semibold tracking-[0.12em] text-primary uppercase'>
              <MapPinIcon className='size-3.5' aria-hidden />
              Rental spaces in Tuguegarao City
            </p>
            <h1 className='font-heading text-[clamp(2.75rem,8vw,5.5rem)] leading-[0.95] font-semibold tracking-[-0.055em] text-balance'>
              Room to live.
              <span className='mt-2 block text-primary'>Space to grow.</span>
            </h1>
            <p className='mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8'>
              Comfortable apartments and visible commercial spaces in practical locations,
              supported by straightforward, direct-owner inquiries.
            </p>
            <div className='mt-8 flex flex-col gap-3 sm:flex-row'>
              <Link
                href='#properties'
                className='inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-card)] transition-colors hover:bg-[color-mix(in_oklch,var(--primary),black_14%)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
              >
                Explore properties
                <ArrowRightIcon className='size-4' aria-hidden />
              </Link>
              <a
                href='mailto:8turfapt@gmail.com?subject=8TURF%20Property%20Inquiry'
                className='inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 text-sm font-semibold shadow-[var(--shadow-card)] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
              >
                <MailIcon className='size-4 text-primary' aria-hidden />
                Inquire by email
              </a>
            </div>
            <ul className='mt-9 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-6'>
              {['Practical locations', 'Secure access', 'Direct owner inquiry'].map((item) => (
                <li key={item} className='flex items-center gap-2'>
                  <CheckCircle2Icon className='size-4 text-primary' aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className='relative mx-auto w-full max-w-2xl lg:max-w-none'>
            <div className='relative aspect-[4/5] overflow-hidden rounded-[1.75rem] border border-white/60 bg-card shadow-[0_24px_80px_-28px_rgba(17,24,19,0.35)] sm:aspect-[5/4] lg:aspect-[4/5] xl:aspect-[5/4]'>
              <Image
                src='/properties/apartments-exterior.webp'
                alt='Exterior of 8TURF Apartments in Tuguegarao City'
                fill
                priority
                sizes='(max-width: 1024px) 100vw, 55vw'
                className='object-cover'
              />
              <div className='absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5 pt-20 text-white sm:p-7'>
                <p className='font-heading text-xl font-semibold sm:text-2xl'>8TURF Apartments</p>
                <p className='mt-1 text-sm text-white/80'>Vista Del Rio Subdivision, Alimannao</p>
              </div>
            </div>
            <div className='absolute -right-2 -bottom-6 w-[45%] overflow-hidden rounded-2xl border-4 border-background bg-card shadow-2xl sm:-right-5 sm:bottom-6 lg:-right-6'>
              <div className='relative aspect-square'>
                <Image
                  src='/properties/commercial-exterior.webp'
                  alt='Street-facing exterior of 8TURF Commercial'
                  fill
                  sizes='(max-width: 1024px) 45vw, 24vw'
                  className='object-cover'
                />
              </div>
              <div className='hidden border-t border-border bg-card p-4 sm:block'>
                <p className='font-heading text-sm font-semibold'>8TURF Commercial</p>
                <p className='mt-0.5 text-xs text-muted-foreground'>Visible street frontage</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className='scroll-mt-20 px-4 py-20 sm:px-6 sm:py-24 lg:px-8' id='properties'>
        <div className='mx-auto max-w-7xl'>
          <div className='mx-auto max-w-2xl text-center'>
            <p className='text-xs font-semibold tracking-[0.16em] text-primary uppercase'>
              Our properties
            </p>
            <h2 className='mt-3 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-5xl'>
              Two rental options under one trusted name
            </h2>
            <p className='mt-5 text-base leading-7 text-muted-foreground sm:text-lg'>
              Straightforward spaces for residents and growing local businesses.
            </p>
          </div>

          <div className='mt-12 grid gap-6 lg:grid-cols-2'>
            <article className='group overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]'>
              <div className='relative aspect-[16/10] overflow-hidden bg-muted'>
                <Image
                  src='/properties/apartments-exterior.webp'
                  alt='8TURF Apartments building exterior'
                  fill
                  sizes='(max-width: 1024px) 100vw, 50vw'
                  className='object-cover transition-transform duration-500 group-hover:scale-[1.025]'
                />
              </div>
              <div className='p-6 sm:p-8'>
                <span className='inline-flex rounded-full bg-success-muted px-3 py-1 text-xs font-semibold text-primary'>
                  Residential
                </span>
                <h3 className='mt-4 font-heading text-2xl font-semibold sm:text-3xl'>
                  8TURF Apartments
                </h3>
                <p className='mt-3 leading-7 text-muted-foreground'>
                  A peaceful and breezy place to stay near MCNP, Toyota, and the Capitol area.
                </p>
                <Link
                  href='#apartments'
                  className='mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg font-semibold text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
                >
                  View apartment details
                  <ArrowRightIcon className='size-4 transition-transform group-hover:translate-x-1' />
                </Link>
              </div>
            </article>

            <article className='group overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]'>
              <div className='relative aspect-[16/10] overflow-hidden bg-muted'>
                <Image
                  src='/properties/commercial-exterior.webp'
                  alt='8TURF Commercial building exterior'
                  fill
                  sizes='(max-width: 1024px) 100vw, 50vw'
                  className='object-cover transition-transform duration-500 group-hover:scale-[1.025]'
                />
              </div>
              <div className='p-6 sm:p-8'>
                <span className='inline-flex rounded-full bg-info-muted px-3 py-1 text-xs font-semibold text-info'>
                  Commercial
                </span>
                <h3 className='mt-4 font-heading text-2xl font-semibold sm:text-3xl'>
                  8TURF Commercial
                </h3>
                <p className='mt-3 leading-7 text-muted-foreground'>
                  Street-facing spaces suited for retail, services, office use, and local
                  businesses.
                </p>
                <Link
                  href='#commercial'
                  className='mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg font-semibold text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
                >
                  View commercial details
                  <ArrowRightIcon className='size-4 transition-transform group-hover:translate-x-1' />
                </Link>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section
        className='scroll-mt-20 border-y border-border bg-muted px-4 py-20 sm:px-6 sm:py-24 lg:px-8'
        id='apartments'
      >
        <div className='mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-16'>
          <div>
            <p className='text-xs font-semibold tracking-[0.16em] text-primary uppercase'>
              8TURF Apartments
            </p>
            <h2 className='mt-3 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-5xl'>
              Comfortable city living in a calm residential setting
            </h2>
            <p className='mt-5 text-base leading-7 text-muted-foreground sm:text-lg'>
              Located at Vista Del Rio Subdivision, Brgy. Alimannao, near MCNP, Toyota, and the
              Cagayan Provincial Capitol.
            </p>
            <div className='my-8 h-px bg-border' />
            <FeatureGrid features={apartmentFeatures} />
            <a
              href='mailto:8turfapt@gmail.com?subject=8TURF%20Apartments%20Availability'
              className='mt-8 inline-flex min-h-11 items-center gap-2 rounded-lg font-semibold text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
            >
              Ask about apartment availability
              <ArrowRightIcon className='size-4' aria-hidden />
            </a>
          </div>
          <PropertyGallery images={apartmentImages} label='8TURF Apartments' />
        </div>
      </section>

      <section
        className='scroll-mt-20 px-4 py-20 sm:px-6 sm:py-24 lg:px-8'
        id='commercial'
      >
        <div className='mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-16'>
          <div className='lg:order-2'>
            <p className='text-xs font-semibold tracking-[0.16em] text-primary uppercase'>
              8TURF Commercial
            </p>
            <h2 className='mt-3 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-5xl'>
              A visible and flexible address for your business
            </h2>
            <p className='mt-5 text-base leading-7 text-muted-foreground sm:text-lg'>
              Commercial rental spaces with direct street exposure, practical access, and
              adaptable layouts for local entrepreneurs.
            </p>
            <div className='my-8 h-px bg-border' />
            <FeatureGrid features={commercialFeatures} />
            <a
              href='mailto:8turfapt@gmail.com?subject=8TURF%20Commercial%20Availability'
              className='mt-8 inline-flex min-h-11 items-center gap-2 rounded-lg font-semibold text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
            >
              Ask about commercial availability
              <ArrowRightIcon className='size-4' aria-hidden />
            </a>
          </div>
          <div className='lg:order-1'>
            <PropertyGallery images={commercialImages} label='8TURF Commercial' />
          </div>
        </div>
      </section>

      <section
        className='scroll-mt-20 bg-[color-mix(in_oklch,var(--primary),black_38%)] px-4 py-20 text-primary-foreground sm:px-6 sm:py-24 lg:px-8'
        id='contact'
      >
        <div className='mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_auto]'>
          <div className='max-w-3xl'>
            <p className='text-xs font-semibold tracking-[0.16em] text-primary-foreground/65 uppercase'>
              Rent with 8TURF
            </p>
            <h2 className='mt-3 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-5xl'>
              Find the right space for your next move
            </h2>
            <p className='mt-5 max-w-2xl text-base leading-7 text-primary-foreground/70 sm:text-lg'>
              Tell us which property you are interested in and your preferred viewing schedule.
              We will reply with current availability and rental details.
            </p>
          </div>
          <a
            href='mailto:8turfapt@gmail.com?subject=8TURF%20Property%20Viewing%20Request'
            className='inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-card px-6 text-sm font-semibold text-foreground shadow-xl transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/50 sm:w-fit'
          >
            <MailIcon className='size-4 text-primary' aria-hidden />
            Email 8TURF
          </a>
        </div>
      </section>

      <footer className='border-t border-border bg-card px-4 py-10 sm:px-6 lg:px-8'>
        <div className='mx-auto flex max-w-7xl flex-col gap-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <p className='font-heading text-base font-semibold text-foreground'>8TURF Properties</p>
            <p className='mt-1'>Residential and commercial rental spaces in Tuguegarao City.</p>
          </div>
          <div className='flex flex-col gap-2 sm:items-end'>
            <a
              href='mailto:8turfapt@gmail.com'
              className='rounded-sm font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
            >
              8turfapt@gmail.com
            </a>
            <p>© {new Date().getFullYear()} 8TURF Properties</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
