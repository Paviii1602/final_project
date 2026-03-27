import os, math, time, json, hashlib
from datetime import datetime

# ── gevent monkey-patch MUST be first ────────────────────────────────────────
from gevent import monkey
monkey.patch_all()

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO, emit, join_room, leave_room

# ── App Setup ─────────────────────────────────────────────────────────────────
BASE_DIR     = os.path.abspath(os.path.dirname(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, 'static_frontend')

app = Flask(__name__, static_folder=None)
app.config['SECRET_KEY']                     = os.getenv('SECRET_KEY', 'navbus-secret-2024-change-me')
app.config['SQLALCHEMY_DATABASE_URI']        = f"sqlite:///{os.path.join(BASE_DIR, 'navbus.db')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Allow ALL origins — web browser, APK (capacitor://), localhost, Render preview
CORS(app,
     origins='*',
     allow_headers=['Content-Type', 'Authorization', 'X-Requested-With'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     supports_credentials=False)

db = SQLAlchemy(app)

socketio = SocketIO(
    app,
    cors_allowed_origins='*',
    async_mode='gevent',       # gevent instead of deprecated eventlet
    ping_timeout=25,
    ping_interval=10,
    logger=False,
    engineio_logger=False,
)

# ── Models ────────────────────────────────────────────────────────────────────

class User(db.Model):
    __tablename__ = 'users'
    id         = db.Column(db.Integer, primary_key=True)
    username   = db.Column(db.String(80), unique=True, nullable=False)
    password   = db.Column(db.String(200), nullable=False)
    role       = db.Column(db.String(20), default='passenger')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Route(db.Model):
    __tablename__ = 'routes'
    id          = db.Column(db.Integer, primary_key=True)
    route_name  = db.Column(db.String(200), nullable=False)
    start_point = db.Column(db.String(100), nullable=False)
    end_point   = db.Column(db.String(100), nullable=False)
    stops       = db.relationship('Stop', backref='route', lazy=True, order_by='Stop.order')
    buses       = db.relationship('Bus',  backref='route', lazy=True)

class Stop(db.Model):
    __tablename__ = 'stops'
    id       = db.Column(db.Integer, primary_key=True)
    route_id = db.Column(db.Integer, db.ForeignKey('routes.id'), nullable=False)
    name     = db.Column(db.String(100), nullable=False)
    lat      = db.Column(db.Float, nullable=False)
    lng      = db.Column(db.Float, nullable=False)
    order    = db.Column(db.Integer, nullable=False)

class Bus(db.Model):
    __tablename__ = 'buses'
    id              = db.Column(db.Integer, primary_key=True)
    name            = db.Column(db.String(100), nullable=False)
    bus_number      = db.Column(db.String(50),  nullable=False)
    route_id        = db.Column(db.Integer, db.ForeignKey('routes.id'), nullable=False)
    operating_hours = db.Column(db.String(50),  default='5:00 - 21:00')
    schedule_json   = db.Column(db.Text,         default='[]')
    live_lat        = db.Column(db.Float,    nullable=True)
    live_lng        = db.Column(db.Float,    nullable=True)
    live_speed      = db.Column(db.Float,    nullable=True)
    live_updated_at = db.Column(db.DateTime, nullable=True)
    source_type     = db.Column(db.String(20), default='schedule')
    is_active       = db.Column(db.Boolean,  default=False)

    def get_schedule(self):
        return json.loads(self.schedule_json)

class ActiveTrip(db.Model):
    __tablename__ = 'active_trips'
    id            = db.Column(db.Integer, primary_key=True)
    driver_id     = db.Column(db.Integer, db.ForeignKey('users.id'),  nullable=False)
    bus_id        = db.Column(db.Integer, db.ForeignKey('buses.id'),  nullable=False)
    route_id      = db.Column(db.Integer, db.ForeignKey('routes.id'), nullable=False)
    started_at    = db.Column(db.DateTime, default=datetime.utcnow)
    ended_at      = db.Column(db.DateTime, nullable=True)
    is_active     = db.Column(db.Boolean,  default=True)
    current_lat   = db.Column(db.Float,    nullable=True)
    current_lng   = db.Column(db.Float,    nullable=True)
    current_speed = db.Column(db.Float,    nullable=True)

# ── Helpers ───────────────────────────────────────────────────────────────────

def hash_pw(p):
    return hashlib.sha256(str(p).encode()).hexdigest()

def get_json_safe():
    """Parse request body safely — never crashes on bad/empty input."""
    try:
        data = request.get_json(force=True, silent=True)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}

def haversine(lat1, lng1, lat2, lng2):
    R    = 6371
    d1   = math.radians(lat2 - lat1)
    d2   = math.radians(lng2 - lng1)
    a    = math.sin(d1/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d2/2)**2
    return R * 2 * math.asin(math.sqrt(max(0, a)))

def nearest_stop_idx(stops, bus_lat, bus_lng):
    if not bus_lat or not bus_lng or not stops:
        return -1
    best, best_d = 0, float('inf')
    for i, s in enumerate(stops):
        d = haversine(bus_lat, bus_lng, s.lat, s.lng)
        if d < best_d:
            best, best_d = i, d
    return best

def build_eta_list(stops, bus_lat, bus_lng, bus_speed, cur_idx):
    speed = bus_speed if bus_speed and bus_speed > 2 else 20
    result = []
    for i, s in enumerate(stops):
        if i < cur_idx:
            result.append({'order': s.order, 'name': s.name, 'lat': s.lat, 'lng': s.lng,
                           'status': 'passed', 'eta_minutes': None, 'distance_km': None})
        elif i == cur_idx:
            d = haversine(bus_lat, bus_lng, s.lat, s.lng)
            result.append({'order': s.order, 'name': s.name, 'lat': s.lat, 'lng': s.lng,
                           'status': 'arriving', 'eta_minutes': 0, 'distance_km': round(d, 2)})
        else:
            d = haversine(bus_lat, bus_lng, stops[cur_idx].lat, stops[cur_idx].lng)
            for j in range(cur_idx, i):
                d += haversine(stops[j].lat, stops[j].lng, stops[j+1].lat, stops[j+1].lng)
            eta = max(1, round(d / speed * 60))
            result.append({'order': s.order, 'name': s.name, 'lat': s.lat, 'lng': s.lng,
                           'status': 'upcoming', 'eta_minutes': eta, 'distance_km': round(d, 2)})
    return result

def get_next_dep(schedule):
    now_m = datetime.now().hour * 60 + datetime.now().minute
    for t in schedule:
        h, m = map(int, t.split(':'))
        if h * 60 + m > now_m:
            return t
    return schedule[0] if schedule else None

def schedule_status(schedule):
    now_m, found = datetime.now().hour * 60 + datetime.now().minute, False
    out = []
    for t in schedule:
        h, m = map(int, t.split(':'))
        dep = h * 60 + m
        if dep < now_m:
            out.append({'time': t, 'status': 'past'})
        elif not found:
            out.append({'time': t, 'status': 'next'})
            found = True
        else:
            out.append({'time': t, 'status': 'future'})
    return out

def bus_live(b):
    """True only when GPS was updated within the last 5 minutes."""
    if not b.is_active or not b.live_lat or not b.live_lng:
        return False
    if not b.live_updated_at:
        return False
    try:
        # Strip timezone info if present — SQLite stores naive datetimes
        updated = b.live_updated_at.replace(tzinfo=None) if b.live_updated_at.tzinfo else b.live_updated_at
        return (datetime.utcnow() - updated).total_seconds() < 300
    except Exception:
        return False

def push_update(bus_id, payload):
    socketio.emit('bus_update', payload, room=f'bus_{bus_id}')

# ── AUTH ──────────────────────────────────────────────────────────────────────

@app.route('/api/auth/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    d        = get_json_safe()
    username = d.get('username', '').strip()
    password = d.get('password', '').strip()
    if not username or not password:
        return jsonify({'error': 'Please enter username and password'}), 400
    u = User.query.filter_by(username=username, password=hash_pw(password)).first()
    if not u:
        return jsonify({'error': 'Invalid username or password'}), 401
    return jsonify({'user': {'id': u.id, 'username': u.username, 'role': u.role}})

@app.route('/api/auth/register', methods=['POST', 'OPTIONS'])
def register():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    d        = get_json_safe()
    username = d.get('username', '').strip()
    password = d.get('password', '').strip()
    role     = d.get('role', 'passenger')
    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
    if len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already taken. Try another.'}), 409
    u = User(username=username, password=hash_pw(password), role=role)
    db.session.add(u)
    db.session.commit()
    return jsonify({'message': 'Registered', 'user': {'id': u.id, 'username': u.username, 'role': u.role}}), 201

# ── ROUTES ────────────────────────────────────────────────────────────────────

@app.route('/api/routes')
def get_routes():
    return jsonify([{'id': r.id, 'route_name': r.route_name,
                     'start_point': r.start_point, 'end_point': r.end_point,
                     'stop_count': len(r.stops)} for r in Route.query.all()])

@app.route('/api/routes/<int:rid>')
def get_route(rid):
    r = db.session.get(Route, rid)
    if not r:
        return jsonify({'error': 'Route not found'}), 404
    return jsonify({
        'id': r.id, 'route_name': r.route_name,
        'start_point': r.start_point, 'end_point': r.end_point,
        'stops': [{'id': s.id, 'name': s.name, 'lat': s.lat, 'lng': s.lng, 'order': s.order} for s in r.stops],
        'buses': [{'id': b.id, 'name': b.name, 'bus_number': b.bus_number,
                   'is_active': bus_live(b), 'source_type': b.source_type} for b in r.buses],
    })

# ── STOPS ─────────────────────────────────────────────────────────────────────

@app.route('/api/stops/all')
def all_stops():
    return jsonify(sorted({s.name for s in Stop.query.all()}))

@app.route('/api/stops/search')
def search_stops():
    frm     = request.args.get('from', '').lower().strip()
    to      = request.args.get('to',   '').lower().strip()
    if not frm or not to:
        return jsonify([])
    results = []
    for route in Route.query.all():
        names = [s.name.lower() for s in route.stops]
        fi    = next((i for i, n in enumerate(names) if frm in n), None)
        ti    = next((i for i, n in enumerate(names) if to  in n), None)
        if fi is not None and ti is not None and fi < ti:
            seg   = route.stops[fi:ti + 1]
            buses = []
            for b in route.buses:
                live  = bus_live(b)
                sched = b.get_schedule()
                buses.append({
                    'id': b.id, 'name': b.name, 'bus_number': b.bus_number,
                    'is_active': live, 'source_type': b.source_type,
                    'live_lat': b.live_lat if live else None,
                    'live_lng': b.live_lng if live else None,
                    'next_departure': get_next_dep(sched),
                })
            results.append({
                'route_id':   route.id,
                'route_name': route.route_name,
                'stops':     [{'id': s.id, 'name': s.name, 'lat': s.lat, 'lng': s.lng, 'order': s.order} for s in seg],
                'all_stops': [{'id': s.id, 'name': s.name, 'lat': s.lat, 'lng': s.lng, 'order': s.order} for s in route.stops],
                'buses':     buses,
            })
    return jsonify(results)

# ── BUSES ─────────────────────────────────────────────────────────────────────

@app.route('/api/buses')
def get_buses():
    buses, seen = [], set()
    for b in Bus.query.all():
        if b.name in seen:
            continue
        seen.add(b.name)
        sched = b.get_schedule()
        buses.append({
            'id': b.id, 'name': b.name, 'bus_number': b.bus_number,
            'route_id': b.route_id, 'operating_hours': b.operating_hours,
            'is_active': bus_live(b), 'source_type': b.source_type,
            'next_departure': get_next_dep(sched),
        })
    return jsonify(buses)

@app.route('/api/buses/<int:bid>')
def get_bus(bid):
    b = db.session.get(Bus, bid)
    if not b:
        return jsonify({'error': 'Bus not found'}), 404
    route   = db.session.get(Route, b.route_id)
    stops   = list(route.stops) if route else []
    live    = bus_live(b)
    sched   = b.get_schedule()
    cur_idx = nearest_stop_idx(stops, b.live_lat, b.live_lng) if live else -1
    etas    = build_eta_list(stops, b.live_lat, b.live_lng, b.live_speed, cur_idx) if live else []
    return jsonify({
        'id': b.id, 'name': b.name, 'bus_number': b.bus_number,
        'route_id':     b.route_id,
        'route_name':   route.route_name  if route else '',
        'start_point':  route.start_point if route else '',
        'end_point':    route.end_point   if route else '',
        'operating_hours': b.operating_hours,
        'schedule':     schedule_status(sched),
        'next_departure': get_next_dep(sched),
        'is_active':    live,
        'source_type':  b.source_type,
        'live_lat':     b.live_lat    if live else None,
        'live_lng':     b.live_lng    if live else None,
        'live_speed':   b.live_speed  if live else None,
        'stops':  [{'id': s.id, 'name': s.name, 'lat': s.lat, 'lng': s.lng, 'order': s.order} for s in stops],
        'eta':    etas,
        'current_stop': stops[cur_idx].name if live and cur_idx >= 0 else None,
    })

@app.route('/api/buses/<int:bid>/location', methods=['POST'])
def update_location(bid):
    b = db.session.get(Bus, bid)
    if not b:
        return jsonify({'error': 'Bus not found'}), 404
    d = get_json_safe()
    lat = d.get('lat')
    lng = d.get('lng')
    if lat is None or lng is None:
        return jsonify({'error': 'lat and lng are required'}), 400
    b.live_lat        = lat
    b.live_lng        = lng
    b.live_speed      = d.get('speed', 0)
    b.live_updated_at = datetime.utcnow()
    b.source_type     = d.get('source_type', 'crowdsourced')
    b.is_active       = True
    db.session.commit()
    push_update(bid, {'bus_id': bid, 'lat': lat, 'lng': lng,
                      'speed': b.live_speed, 'source_type': b.source_type,
                      'ts': datetime.utcnow().isoformat()})
    return jsonify({'message': 'Location updated'})

# ── DRIVER TRIP ───────────────────────────────────────────────────────────────

@app.route('/api/driver/start-trip', methods=['POST'])
def start_trip():
    d = get_json_safe()
    bus = db.session.get(Bus, d.get('bus_id'))
    if bus:
        bus.is_active   = True
        bus.source_type = 'driver_live'
    trip = ActiveTrip(driver_id=d.get('driver_id'),
                      bus_id=d.get('bus_id'),
                      route_id=d.get('route_id'))
    db.session.add(trip)
    db.session.commit()
    return jsonify({'trip_id': trip.id, 'message': 'Trip started'})

@app.route('/api/driver/update-location', methods=['POST'])
def driver_update():
    d    = get_json_safe()
    trip = ActiveTrip.query.filter_by(id=d.get('trip_id'), is_active=True).first()
    if not trip:
        return jsonify({'error': 'No active trip found'}), 404
    lat   = d.get('lat')
    lng   = d.get('lng')
    speed = d.get('speed', 0)
    if lat is None or lng is None:
        return jsonify({'error': 'lat and lng are required'}), 400
    trip.current_lat   = lat
    trip.current_lng   = lng
    trip.current_speed = speed
    bus = db.session.get(Bus, trip.bus_id)
    if bus:
        bus.live_lat        = lat
        bus.live_lng        = lng
        bus.live_speed      = speed
        bus.live_updated_at = datetime.utcnow()
        bus.source_type     = 'driver_live'
        bus.is_active       = True
    db.session.commit()
    push_update(trip.bus_id, {'bus_id': trip.bus_id, 'lat': lat, 'lng': lng,
                               'speed': speed, 'source_type': 'driver_live',
                               'ts': datetime.utcnow().isoformat()})
    return jsonify({'message': 'Location updated'})

@app.route('/api/driver/end-trip', methods=['POST'])
def end_trip():
    d    = get_json_safe()
    trip = ActiveTrip.query.filter_by(id=d.get('trip_id'), is_active=True).first()
    if not trip:
        return jsonify({'error': 'No active trip found'}), 404
    trip.is_active = False
    trip.ended_at  = datetime.utcnow()
    bus = db.session.get(Bus, trip.bus_id)
    if bus:
        bus.is_active       = False
        bus.source_type     = 'schedule'
        bus.live_lat        = None
        bus.live_lng        = None
        bus.live_speed      = None
        bus.live_updated_at = None
    db.session.commit()
    push_update(trip.bus_id, {'bus_id': trip.bus_id, 'is_active': False, 'source_type': 'schedule'})
    return jsonify({'message': 'Trip ended'})

# ── WEBSOCKET EVENTS ──────────────────────────────────────────────────────────

@socketio.on('connect')
def on_connect():
    emit('connected', {'msg': 'NavBus live ✓'})

@socketio.on('watch_bus')
def on_watch(data):
    bus_id = data.get('bus_id')
    if not bus_id:
        return
    join_room(f'bus_{bus_id}')
    b = db.session.get(Bus, int(bus_id))
    if b and bus_live(b):
        emit('bus_update', {'bus_id': bus_id, 'lat': b.live_lat, 'lng': b.live_lng,
                            'speed': b.live_speed, 'source_type': b.source_type,
                            'ts': b.live_updated_at.isoformat() if b.live_updated_at else None})

@socketio.on('driver_location')
def on_driver_location(data):
    bus_id = data.get('bus_id')
    lat    = data.get('lat')
    lng    = data.get('lng')
    speed  = data.get('speed', 0)
    if not all([bus_id, lat is not None, lng is not None]):
        return
    b = db.session.get(Bus, int(bus_id))
    if b:
        b.live_lat        = lat
        b.live_lng        = lng
        b.live_speed      = speed
        b.live_updated_at = datetime.utcnow()
        b.source_type     = 'driver_live'
        b.is_active       = True
        db.session.commit()
    emit('bus_update', {'bus_id': bus_id, 'lat': lat, 'lng': lng,
                        'speed': speed, 'source_type': 'driver_live',
                        'ts': datetime.utcnow().isoformat()},         room=f'bus_{bus_id}')

@socketio.on('unwatch_bus')
def on_unwatch(data):
    bus_id = data.get('bus_id')
    if bus_id:
        leave_room(f'bus_{bus_id}')

@socketio.on('disconnect')
def on_disconnect():
    pass

# ── HEALTH ────────────────────────────────────────────────────────────────────

@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'time': datetime.utcnow().isoformat(), 'async': 'gevent'})

# ── SPA (serve React frontend) ────────────────────────────────────────────────

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def spa(path):
    # Never intercept socket.io or API routes
    if path.startswith('socket.io') or path.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404
    full = os.path.join(FRONTEND_DIR, path)
    if path and os.path.exists(full):
        return send_from_directory(FRONTEND_DIR, path)
    return send_from_directory(FRONTEND_DIR, 'index.html')

# ── DB INIT ───────────────────────────────────────────────────────────────────

def init_db():
    from seed_data import ROUTES, STOPS, BUSES
    db.create_all()
    if Route.query.count() > 0:
        return
    for r in ROUTES:
        db.session.add(Route(**r))
    db.session.commit()
    for route_id, stop_list in STOPS.items():
        for s in stop_list:
            db.session.add(Stop(route_id=s[0], name=s[1], lat=s[2], lng=s[3], order=s[4]))
    db.session.commit()
    for b in BUSES:
        db.session.add(Bus(name=b['name'], bus_number=b['bus_number'], route_id=b['route_id'],
                           operating_hours=b['operating_hours'],
                           schedule_json=json.dumps(b['schedule'])))
    db.session.commit()
    for uname, pw, role in [('passenger', 'pass123', 'passenger'), ('driver', 'driver123', 'driver')]:
        db.session.add(User(username=uname, password=hash_pw(pw), role=role))
    db.session.commit()
    print('✅ NavBus database ready')

if __name__ == '__main__':
    with app.app_context():
        init_db()
    port = int(os.environ.get('PORT', 8000))
    print(f'')
    print(f'  NavBus running at -> http://localhost:{port}')
    print(f'  Press Ctrl+C to stop')
    print(f'')
    socketio.run(app,
                 host='0.0.0.0',
                 port=port,
                 debug=False,
                 use_reloader=False,
                 allow_unsafe_werkzeug=True)