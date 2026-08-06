'use client';

import { MapPin, X, Calendar, Trophy, MapPinned, ExternalLink, Clock, ShieldCheck, Thermometer, Eye } from 'lucide-react';
import type { MapEvent } from './MapComponent';

interface EventDetailCardProps {
  event: MapEvent;
  onClose: () => void;
}

const SPORT_IMAGES: Record<string, string> = {
  curling: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC4u6nnxQK1duLiMykkefAARD-fL8aRxVw9Wd9F5eKgavd6ni0nduO7FBhNULnbyYOvqO5ipOFHizfWIVHqx4MWOv8qDxmYgq-ZZP-L0QgDWqGaXrUlXyQk7EQzBKbSUyjH0GJMqmIjGcfZttkUftw38F9rWa40ozc9iC5y3YOmKyjBJnzkOPyRhjGnRkV03tIsXLWWfyjBglwcWs-mQAMgSFUrqb0096Dcw0Sej-rYXeVJAfHQLKbqKO_DVXTvzdqgbIdtVzMYGiIm',
  motorsport: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBR7vxnu6Kci33oDSGoper-1qH9Q34BYbVpd5Z-cmjPPPluhEkpCLiN8mz-dRpmEiavMRhq2Nc-DkgkvM-LyOz6K2_gEjwCECXwaSPoONblsHZy85LGAmnMT5pJEifnrsSkFKcA_JRZJBwdS0XHPehEchnNy30Se49DRstCZdg9sUhc0H0FFNbsXP7tB-Bn-6r0op_nquZ4r1H1wXkYYY_P29Fx-7dtEYl4q5edVv7T3V0kF0w_vDd6pq3w2sDyTa7lFVcndqWENOQB',
  f1: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBR7vxnu6Kci33oDSGoper-1qH9Q34BYbVpd5Z-cmjPPPluhEkpCLiN8mz-dRpmEiavMRhq2Nc-DkgkvM-LyOz6K2_gEjwCECXwaSPoONblsHZy85LGAmnMT5pJEifnrsSkFKcA_JRZJBwdS0XHPehEchnNy30Se49DRstCZdg9sUhc0H0FFNbsXP7tB-Bn-6r0op_nquZ4r1H1wXkYYY_P29Fx-7dtEYl4q5edVv7T3V0kF0w_vDd6pq3w2sDyTa7lFVcndqWENOQB',
  golf: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCHNAbjU2Askt8fpMdzfhW5lmezaYYKPC_tjhfMbpXbNZL107eScjjZrL0EIiBM4iRr__Gm6YpoLmIy9h0SBXPQLhRRKkkaSP9cIsx2JzsUfAaLhvbIk-3QYj0uVanX8KVGnNcyQ_ugQRmfo6PtpkczCEhF8oHB800deEKXGdRUSDmtV3NPk-wN9J5_j_uRHve6U_if2NX_0t49pO7Q6OmnoZXE27WlFFqEUm-90cOiedgB2I6gZqbooDbBp8QmbtYaJeOmXRASkFHE',
  generic: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAEvXBuRoENebGnAfwZDfquwcZeDNSSCQMmEprPmfp5Wg5Yv12_ZBeYeiLyErKqyytAXWUsZovjbgliRoY4kKiG2PVcGaatclqo1MUhkxwv1zw4gpsVX3xes0fN2LL1Cx_k51ibS8EaZClHi0ykmmRo3kvlZ9hQpC6t70gKcY97ZnjhIlo0rT5wqxeQntkAslyP3udoebWMH0TdkG_KEbgXwrVB15HvjQqI8VU52-t84W4qTQsCZcK7ul-7UXz7ouAwYV1CcN2NCxL1'
};

const SPORT_SPECS: Record<string, {
  venueTitle: string;
  specs: { label: string; value: string }[];
  ticketTiers: { title: string; badge: string; desc: string; price: string }[];
  hospitality: string;
}> = {
  curling: {
    venueTitle: 'Venue Specs',
    specs: [
      { label: 'Ice Tech', value: 'Mark Shurek Elite' },
      { label: 'Stone Granite', value: 'Ailsa Craig Blue Hone' },
      { label: 'Capacity', value: '5,400 (Intimate)' }
    ],
    ticketTiers: [
      { title: 'Front Row Ice', badge: '2 Left', desc: 'Unobstructed views directly behind the hack. Includes access to players lounge post-game.', price: '$2,500' },
      { title: 'Elite Suite', badge: 'Available', desc: 'Private skybox with dedicated concierge, premium catering, and panoramic views of all sheets.', price: '$12,000' }
    ],
    hospitality: 'All elite tier passes include access to the GrandStand private lounge, featuring top-shelf spirits curated by master sommeliers and gourmet culinary experiences prior to the first draw.'
  },
  motorsport: {
    venueTitle: 'Circuit Intelligence',
    specs: [
      { label: 'Track Length', value: '3.337 km' },
      { label: 'Turns', value: '19 Corners' },
      { label: 'Lap Record', value: '1:14.418' }
    ],
    ticketTiers: [
      { title: 'Paddock Club', badge: 'Few Left', desc: 'Prime viewing directly above the team garages. Full catering, pit lane walks, and driver appearances.', price: '$7,800' },
      { title: 'VIP Grandstand', badge: 'Available', desc: 'Reserved seating at the iconic Casino Square. Includes private hospitality marquee access.', price: '$3,200' }
    ],
    hospitality: 'Paddock Club passes grant entry to the exclusive team suites, featuring open Champagne bars, gourmet dining by Michelin-starred chefs, and private pit lane tours.'
  },
  f1: {
    venueTitle: 'Circuit Intelligence',
    specs: [
      { label: 'Track Length', value: '3.337 km' },
      { label: 'Turns', value: '19 Corners' },
      { label: 'Lap Record', value: '1:14.418' }
    ],
    ticketTiers: [
      { title: 'Paddock Club', badge: 'Few Left', desc: 'Prime viewing directly above the team garages. Full catering, pit lane walks, and driver appearances.', price: '$7,800' },
      { title: 'VIP Grandstand', badge: 'Available', desc: 'Reserved seating at the iconic Casino Square. Includes private hospitality marquee access.', price: '$3,200' }
    ],
    hospitality: 'Paddock Club passes grant entry to the exclusive team suites, featuring open Champagne bars, gourmet dining by Michelin-starred chefs, and private pit lane tours.'
  },
  golf: {
    venueTitle: 'Course Specs',
    specs: [
      { label: 'Par', value: '72' },
      { label: 'Length', value: '7,510 Yards' },
      { label: 'Grass Type', value: 'Bentgrass Greens' }
    ],
    ticketTiers: [
      { title: 'Trophy Suite', badge: 'Available', desc: 'Overlooking the 18th green. Premium open buffet, open bar, and air-conditioned private viewing deck.', price: '$9,500' },
      { title: 'Green Jacket Pass', badge: 'Limited', desc: 'Access to all patron areas and the exclusive clubhouse grounds. Includes daily pairing sheet guides.', price: '$4,000' }
    ],
    hospitality: 'Hospitality guests enjoy private shuttle services across the course, culinary pavilions at key holes, and access to the Founders Lounge with classic Southern cocktails.'
  },
  generic: {
    venueTitle: 'Arena Intelligence',
    specs: [
      { label: 'Venue Type', value: 'Championship Arena' },
      { label: 'Lounge Tier', value: 'Platinum Club' },
      { label: 'Seating Cap', value: 'Elite Configuration' }
    ],
    ticketTiers: [
      { title: 'VIP Club Seats', badge: 'Limited', desc: 'Premium center-court prime seats. Includes priority entrance, complimentary bar, and food service.', price: '$1,800' },
      { title: 'Executive Box', badge: 'Available', desc: 'Private 12-person suite with chef-curated dining, private bar, and dedicated wait staff.', price: '$8,500' }
    ],
    hospitality: 'All VIP and suite tickets feature VIP valet parking, priority check-in, and access to our private member lounge with refreshments served throughout the event.'
  }
};

function getMockWeather(city: string) {
  if (!city) return { temp: '18°C', desc: 'Clear' };
  const c = city.toLowerCase();
  if (c.includes('lethbridge')) return { temp: '-4°C', desc: 'Clear' };
  if (c.includes('monte carlo') || c.includes('monaco')) return { temp: '24°C', desc: 'Sunny' };
  if (c.includes('augusta')) return { temp: '21°C', desc: 'Fair' };
  return { temp: '18°C', desc: 'Clear' };
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function EventDetailCard({ event, onClose }: EventDetailCardProps) {
  const sportLower = event.sport?.toLowerCase() || 'generic';
  const bgImage = SPORT_IMAGES[sportLower] || SPORT_IMAGES.generic;
  const specDetails = SPORT_SPECS[sportLower] || SPORT_SPECS.generic;
  const weather = getMockWeather(event.city || '');

  return (
    <div className="detail-overlay">
      <div className="detail-backdrop" onClick={onClose} />
      <aside className="glass-panel detail-card">
        {/* Close Button */}
        <button className="detail-close-btn" onClick={onClose} aria-label="Close details panel">
          <X />
        </button>

        {/* Hero Image Banner */}
        <div className="detail-header-banner">
          <img src={bgImage} alt={event.name} className="detail-header-img" />
          <div className="detail-header-overlay"></div>
          <div className="detail-header-content">
            <span className="detail-partner-badge">
              <ShieldCheck /> Official VIP Partner
            </span>
            <h2 className="detail-title">{event.name}</h2>
            <p className="detail-subtitle">
              <MapPin />
              {event.venue_name && `${event.venue_name} · `}
              {event.city}{event.country && `, ${event.country}`}
            </p>
          </div>
        </div>

        {/* Bento Grid Body */}
        <div className="detail-body custom-scrollbar">
          {/* Ticket Tiers Column */}
          <div className="detail-column">
            <h3 className="detail-section-title">Passes &amp; Access</h3>
            {specDetails.ticketTiers.map((tier, idx) => (
              <div 
                key={idx} 
                className="bento-card"
                onClick={() => alert(`Purchase flow for ${tier.title} is now opening...`)}
              >
                <div className="bento-card-header">
                  <h4 className="bento-card-title">{tier.title}</h4>
                  <span className="bento-card-badge">{tier.badge}</span>
                </div>
                <p className="bento-card-desc">{tier.desc}</p>
                <div className="bento-card-footer">
                  {tier.price} <span>/ pass</span>
                </div>
              </div>
            ))}
          </div>

          {/* Event Intelligence Column */}
          <div className="detail-column">
            <h3 className="detail-section-title">Event Intelligence</h3>
            
            {/* Specs Bento Card */}
            <div className="bento-card">
              <div className="bento-card-header" style={{ marginBottom: '12px' }}>
                <h4 className="bento-card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPinned style={{ width: '1rem', height: '1rem' }} /> {specDetails.venueTitle}
                </h4>
              </div>
              <ul className="bento-spec-list">
                {specDetails.specs.map((spec, idx) => (
                  <li key={idx} className="bento-spec-item">
                    <span className="bento-spec-label">{spec.label}</span>
                    <span className="bento-spec-value">{spec.value}</span>
                  </li>
                ))}
                {event.start_date && (
                  <li className="bento-spec-item">
                    <span className="bento-spec-label">Start Date</span>
                    <span className="bento-spec-value">{formatDate(event.start_date)}</span>
                  </li>
                )}
                {event.end_date && (
                  <li className="bento-spec-item">
                    <span className="bento-spec-label">End Date</span>
                    <span className="bento-spec-value">{formatDate(event.end_date)}</span>
                  </li>
                )}
              </ul>
            </div>

            {/* Weather Bento Card */}
            <div className="bento-card bento-weather-card">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <Thermometer style={{ width: '1rem', height: '1rem', color: 'var(--accent)' }} />
                  <span className="bento-spec-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Local Weather</span>
                </div>
                <p className="bento-spec-value">{event.city || 'Venue Location'}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p className="bento-weather-temp">{weather.temp}</p>
                <p className="bento-spec-label" style={{ color: 'var(--accent)' }}>{weather.desc}</p>
              </div>
            </div>
          </div>

          {/* VIP Hospitality Section Banner */}
          <div className="bento-banner">
            <h3 className="bento-banner-title">VIP Hospitality Included</h3>
            <p className="bento-banner-desc">{specDetails.hospitality}</p>
          </div>

          {/* External Source Website Section */}
          {event.source_url && (
            <div className="bento-card" style={{ gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="bento-spec-label">Official Event Website</span>
                <a
                  href={event.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                  style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                >
                  <ExternalLink style={{ width: '0.875rem', height: '0.875rem' }} /> View Source
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer CTAs */}
        <footer className="detail-footer">
          <p className="bento-spec-label mr-auto" style={{ display: 'none' }}>Secure checkout via GrandStand Concierge</p>
          <button 
            className="btn-secondary"
            onClick={() => alert('Starting Virtual Tour... 3D rendering of the suites and seating positions.')}
          >
            <Eye style={{ width: '1rem', height: '1rem' }} /> Virtual Venue Tour
          </button>
          <button 
            className="btn-primary"
            onClick={() => alert('Proceeding to VIP Checkout for ' + event.name)}
          >
            Acquire Passes
          </button>
        </footer>
      </aside>
    </div>
  );
}
