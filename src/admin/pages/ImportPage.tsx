import { useNavigate } from 'react-router-dom';
import { useAdminData } from '../AdminData';
import BookingImport from '../BookingImport';
import { fmtLong } from '../calendarLogic';

/** External users' page: the VTOP booking import, without the rest of Venues. */
export default function ImportPage() {
  const { bookings, settings } = useAdminData();
  const navigate = useNavigate();
  const asOf = typeof settings.venue_data_as_of === 'string' ? settings.venue_data_as_of : null;

  return (
    <>
      <div className="top">
        <div>
          <h1>Import bookings</h1>
          <div className="sub">Add VTOP venue bookings to the calendar. {asOf && <>Venue data as of {fmtLong(asOf)}.</>}</div>
        </div>
        <button className="ghost" onClick={() => navigate('/admin/calendar?venues=1')}>Availability on the calendar</button>
      </div>
      <section className="panel">
        <div className="list-head">
          <h3 className="ph">Venue bookings</h3>
          <span className="asof">{bookings.length} bookings on file</span>
        </div>
        <BookingImport />
      </section>
    </>
  );
}
