--
-- PostgreSQL database dump
--

\restrict R6uFaQopdieEuuOB3BEdpq83chZKH3L8623bkLxrBrdGXIuFgtUMFgkSxMbfUfc

-- Dumped from database version 18.6 (Debian 18.6-1.pgdg13+2)
-- Dumped by pg_dump version 18.6 (Debian 18.6-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.settings DROP CONSTRAINT IF EXISTS settings_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY public.reviews DROP CONSTRAINT IF EXISTS reviews_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.reviews DROP CONSTRAINT IF EXISTS reviews_court_id_fkey;
ALTER TABLE IF EXISTS ONLY public.reviews DROP CONSTRAINT IF EXISTS reviews_booking_id_fkey;
ALTER TABLE IF EXISTS ONLY public.payments DROP CONSTRAINT IF EXISTS payments_reviewed_by_fkey;
ALTER TABLE IF EXISTS ONLY public.payments DROP CONSTRAINT IF EXISTS payments_booking_id_fkey;
ALTER TABLE IF EXISTS ONLY public.equipment DROP CONSTRAINT IF EXISTS equipment_sport_id_fkey;
ALTER TABLE IF EXISTS ONLY public.emails DROP CONSTRAINT IF EXISTS emails_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.emails DROP CONSTRAINT IF EXISTS emails_booking_id_fkey;
ALTER TABLE IF EXISTS ONLY public.courts DROP CONSTRAINT IF EXISTS courts_sport_id_fkey;
ALTER TABLE IF EXISTS ONLY public.bookings DROP CONSTRAINT IF EXISTS bookings_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.bookings DROP CONSTRAINT IF EXISTS bookings_coupon_id_fkey;
ALTER TABLE IF EXISTS ONLY public.booking_slots DROP CONSTRAINT IF EXISTS booking_slots_court_id_fkey;
ALTER TABLE IF EXISTS ONLY public.booking_slots DROP CONSTRAINT IF EXISTS booking_slots_booking_id_fkey;
ALTER TABLE IF EXISTS ONLY public.booking_equipment DROP CONSTRAINT IF EXISTS booking_equipment_equipment_id_fkey;
ALTER TABLE IF EXISTS ONLY public.booking_equipment DROP CONSTRAINT IF EXISTS booking_equipment_booking_id_fkey;
DROP INDEX IF EXISTS public.one_cart_per_user;
DROP INDEX IF EXISTS public.emails_by_user;
DROP INDEX IF EXISTS public.booking_equipment_active;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE IF EXISTS ONLY public.sports DROP CONSTRAINT IF EXISTS sports_pkey;
ALTER TABLE IF EXISTS ONLY public.sports DROP CONSTRAINT IF EXISTS sports_name_key;
ALTER TABLE IF EXISTS ONLY public.settings DROP CONSTRAINT IF EXISTS settings_pkey;
ALTER TABLE IF EXISTS ONLY public.reviews DROP CONSTRAINT IF EXISTS reviews_pkey;
ALTER TABLE IF EXISTS ONLY public.reviews DROP CONSTRAINT IF EXISTS reviews_booking_id_court_id_key;
ALTER TABLE IF EXISTS ONLY public.payments DROP CONSTRAINT IF EXISTS payments_pkey;
ALTER TABLE IF EXISTS ONLY public.booking_slots DROP CONSTRAINT IF EXISTS no_overlap;
ALTER TABLE IF EXISTS ONLY public.migrations DROP CONSTRAINT IF EXISTS migrations_pkey;
ALTER TABLE IF EXISTS ONLY public.equipment DROP CONSTRAINT IF EXISTS equipment_pkey;
ALTER TABLE IF EXISTS ONLY public.emails DROP CONSTRAINT IF EXISTS emails_pkey;
ALTER TABLE IF EXISTS ONLY public.courts DROP CONSTRAINT IF EXISTS courts_pkey;
ALTER TABLE IF EXISTS ONLY public.coupons DROP CONSTRAINT IF EXISTS coupons_pkey;
ALTER TABLE IF EXISTS ONLY public.coupons DROP CONSTRAINT IF EXISTS coupons_code_key;
ALTER TABLE IF EXISTS ONLY public.bookings DROP CONSTRAINT IF EXISTS bookings_pkey;
ALTER TABLE IF EXISTS ONLY public.bookings DROP CONSTRAINT IF EXISTS bookings_code_key;
ALTER TABLE IF EXISTS ONLY public.bookings DROP CONSTRAINT IF EXISTS bookings_checkin_token_key;
ALTER TABLE IF EXISTS ONLY public.booking_slots DROP CONSTRAINT IF EXISTS booking_slots_pkey;
ALTER TABLE IF EXISTS ONLY public.booking_equipment DROP CONSTRAINT IF EXISTS booking_equipment_pkey;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.sports;
DROP TABLE IF EXISTS public.settings;
DROP TABLE IF EXISTS public.reviews;
DROP TABLE IF EXISTS public.payments;
DROP TABLE IF EXISTS public.migrations;
DROP TABLE IF EXISTS public.equipment;
DROP TABLE IF EXISTS public.emails;
DROP TABLE IF EXISTS public.courts;
DROP VIEW IF EXISTS public.booking_totals;
DROP TABLE IF EXISTS public.coupons;
DROP TABLE IF EXISTS public.bookings;
DROP TABLE IF EXISTS public.booking_slots;
DROP TABLE IF EXISTS public.booking_equipment;
DROP TYPE IF EXISTS public.user_status;
DROP TYPE IF EXISTS public.user_role;
DROP TYPE IF EXISTS public.payment_status;
DROP TYPE IF EXISTS public.email_status;
DROP TYPE IF EXISTS public.booking_status;
DROP EXTENSION IF EXISTS btree_gist;
-- *not* dropping schema, since initdb creates it
--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- Name: booking_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.booking_status AS ENUM (
    'cart',
    'pending_payment',
    'paid',
    'checked_in',
    'completed',
    'cancelled',
    'expired'
);


--
-- Name: email_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.email_status AS ENUM (
    'web',
    'sent',
    'failed'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'member',
    'admin'
);


--
-- Name: user_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_status AS ENUM (
    'active',
    'suspended'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: booking_equipment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_equipment (
    id integer NOT NULL,
    booking_id integer NOT NULL,
    equipment_id integer NOT NULL,
    qty integer NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    price numeric(10,2) NOT NULL,
    active boolean DEFAULT false NOT NULL,
    returned_at timestamp with time zone,
    condition_note text,
    fine numeric(10,2) DEFAULT 0 NOT NULL,
    CONSTRAINT booking_equipment_check CHECK ((start_at < end_at)),
    CONSTRAINT booking_equipment_qty_check CHECK ((qty > 0))
);


--
-- Name: booking_equipment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.booking_equipment ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.booking_equipment_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: booking_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_slots (
    id integer NOT NULL,
    booking_id integer NOT NULL,
    court_id integer NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    price numeric(10,2) NOT NULL,
    active boolean DEFAULT false NOT NULL,
    CONSTRAINT booking_slots_check CHECK ((start_at < end_at))
);


--
-- Name: booking_slots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.booking_slots ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.booking_slots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id integer NOT NULL,
    code text NOT NULL,
    user_id integer NOT NULL,
    status public.booking_status DEFAULT 'cart'::public.booking_status NOT NULL,
    confirmed_at timestamp with time zone,
    expires_at timestamp with time zone,
    checkin_token uuid,
    reminder_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    coupon_id integer,
    discount numeric(10,2) DEFAULT 0 NOT NULL
);


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupons (
    id integer NOT NULL,
    code text NOT NULL,
    percent_off smallint,
    amount_off numeric(10,2),
    min_total numeric(10,2) DEFAULT 0 NOT NULL,
    max_uses integer,
    used_count integer DEFAULT 0 NOT NULL,
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    per_user_limit integer,
    CONSTRAINT coupons_amount_off_check CHECK ((amount_off > (0)::numeric)),
    CONSTRAINT coupons_check CHECK (((percent_off IS NULL) <> (amount_off IS NULL))),
    CONSTRAINT coupons_code_check CHECK ((code = upper(code))),
    CONSTRAINT coupons_max_uses_check CHECK ((max_uses > 0)),
    CONSTRAINT coupons_min_total_check CHECK ((min_total >= (0)::numeric)),
    CONSTRAINT coupons_per_user_limit_check CHECK ((per_user_limit > 0)),
    CONSTRAINT coupons_percent_off_check CHECK (((percent_off >= 1) AND (percent_off <= 100)))
);


--
-- Name: booking_totals; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.booking_totals AS
 SELECT booking_id,
    (subtotal - discount) AS total,
    subtotal,
    discount
   FROM ( SELECT b.id AS booking_id,
            s.subtotal,
                CASE
                    WHEN (b.status = 'cart'::public.booking_status) THEN
                    CASE
                        WHEN ((c.id IS NOT NULL) AND (s.subtotal >= c.min_total)) THEN LEAST(s.subtotal, COALESCE(round(((s.subtotal * (c.percent_off)::numeric) / 100.0), 2), c.amount_off))
                        ELSE (0)::numeric
                    END
                    ELSE b.discount
                END AS discount
           FROM ((public.bookings b
             CROSS JOIN LATERAL ( SELECT (COALESCE(( SELECT sum(booking_slots.price) AS sum
                           FROM public.booking_slots
                          WHERE (booking_slots.booking_id = b.id)), (0)::numeric) + COALESCE(( SELECT sum(booking_equipment.price) AS sum
                           FROM public.booking_equipment
                          WHERE (booking_equipment.booking_id = b.id)), (0)::numeric)) AS subtotal) s)
             LEFT JOIN public.coupons c ON ((c.id = b.coupon_id)))) x;


--
-- Name: bookings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.bookings ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.bookings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: coupons_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.coupons ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.coupons_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: courts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courts (
    id integer NOT NULL,
    sport_id integer NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    price_per_hour numeric(10,2) NOT NULL,
    open_hour smallint DEFAULT 8 NOT NULL,
    close_hour smallint DEFAULT 22 NOT NULL,
    image_url text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    peak_price_per_hour numeric(10,2),
    peak_from_hour smallint,
    CONSTRAINT courts_check CHECK (((0 <= open_hour) AND (open_hour < close_hour) AND (close_hour <= 24))),
    CONSTRAINT courts_peak_from_hour_check CHECK (((peak_from_hour >= 0) AND (peak_from_hour <= 23))),
    CONSTRAINT courts_peak_price_per_hour_check CHECK ((peak_price_per_hour >= (0)::numeric)),
    CONSTRAINT courts_price_per_hour_check CHECK ((price_per_hour >= (0)::numeric)),
    CONSTRAINT peak_both_or_neither CHECK (((peak_price_per_hour IS NULL) = (peak_from_hour IS NULL)))
);


--
-- Name: courts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.courts ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.courts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emails (
    id integer NOT NULL,
    user_id integer,
    booking_id integer,
    kind text NOT NULL,
    to_address text NOT NULL,
    subject text NOT NULL,
    html text NOT NULL,
    status public.email_status DEFAULT 'web'::public.email_status NOT NULL,
    error text,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: emails_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.emails ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.emails_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: equipment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment (
    id integer NOT NULL,
    sport_id integer NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    total_qty integer NOT NULL,
    rent_price numeric(10,2) NOT NULL,
    deposit numeric(10,2) DEFAULT 0 NOT NULL,
    image_url text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT equipment_deposit_check CHECK ((deposit >= (0)::numeric)),
    CONSTRAINT equipment_rent_price_check CHECK ((rent_price >= (0)::numeric)),
    CONSTRAINT equipment_total_qty_check CHECK ((total_qty >= 0))
);


--
-- Name: equipment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.equipment ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.equipment_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migrations (
    name text NOT NULL,
    run_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    booking_id integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    slip_path text NOT NULL,
    status public.payment_status DEFAULT 'pending'::public.payment_status NOT NULL,
    note text,
    reviewed_by integer,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.payments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.payments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id integer NOT NULL,
    booking_id integer NOT NULL,
    user_id integer NOT NULL,
    court_id integer NOT NULL,
    rating smallint NOT NULL,
    comment text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.reviews ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.reviews_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_by integer,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sports (
    id integer NOT NULL,
    name text NOT NULL,
    icon text DEFAULT '🏅'::text NOT NULL
);


--
-- Name: sports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.sports ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.sports_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    name text NOT NULL,
    phone text,
    avatar_url text,
    role public.user_role DEFAULT 'member'::public.user_role NOT NULL,
    status public.user_status DEFAULT 'active'::public.user_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.users ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Data for Name: booking_equipment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.booking_equipment (id, booking_id, equipment_id, qty, start_at, end_at, price, active, returned_at, condition_note, fine) FROM stdin;
1	1	9	1	2026-09-23 09:00:00+07	2026-09-23 10:00:00+07	20.00	t	2026-09-23 10:00:00+07	\N	0.00
2	8	9	2	2026-09-24 13:00:00+07	2026-09-24 14:00:00+07	40.00	t	2026-09-24 14:00:00+07	\N	0.00
3	9	8	1	2026-09-25 13:00:00+07	2026-09-25 14:00:00+07	20.00	t	2026-09-25 14:00:00+07	\N	0.00
4	10	10	1	2026-09-25 08:00:00+07	2026-09-25 09:00:00+07	30.00	t	2026-09-25 09:00:00+07	\N	0.00
5	12	6	1	2026-09-26 12:00:00+07	2026-09-26 13:00:00+07	80.00	t	2026-09-26 13:00:00+07	\N	0.00
6	15	9	2	2026-09-27 14:00:00+07	2026-09-27 15:00:00+07	40.00	t	2026-09-27 15:00:00+07	\N	0.00
7	16	5	2	2026-09-27 10:00:00+07	2026-09-27 11:00:00+07	60.00	t	2026-09-27 11:00:00+07	\N	0.00
8	17	10	2	2026-09-27 11:00:00+07	2026-09-27 12:00:00+07	60.00	t	2026-09-27 12:00:00+07	\N	0.00
9	18	4	2	2026-09-28 11:00:00+07	2026-09-28 12:00:00+07	240.00	t	2026-09-28 12:00:00+07	\N	0.00
10	19	8	2	2026-09-28 14:00:00+07	2026-09-28 15:00:00+07	40.00	t	2026-09-28 15:00:00+07	\N	0.00
11	21	5	1	2026-09-29 18:00:00+07	2026-09-29 19:00:00+07	30.00	t	2026-09-29 19:00:00+07	\N	0.00
12	22	6	2	2026-09-29 10:00:00+07	2026-09-29 11:00:00+07	160.00	t	2026-09-29 11:00:00+07	\N	0.00
13	24	1	2	2026-09-30 14:00:00+07	2026-09-30 15:00:00+07	60.00	t	2026-09-30 15:00:00+07	\N	0.00
14	26	10	1	2026-10-01 12:00:00+07	2026-10-01 13:00:00+07	30.00	t	2026-10-01 13:00:00+07	\N	0.00
15	27	3	2	2026-10-01 15:00:00+07	2026-10-01 16:00:00+07	60.00	t	2026-10-01 16:00:00+07	\N	0.00
16	28	6	2	2026-10-01 18:00:00+07	2026-10-01 19:00:00+07	160.00	t	2026-10-01 19:00:00+07	\N	0.00
17	29	9	1	2026-10-02 18:00:00+07	2026-10-02 19:00:00+07	20.00	t	2026-10-02 19:00:00+07	\N	0.00
18	30	9	2	2026-10-02 12:00:00+07	2026-10-02 13:00:00+07	40.00	t	2026-10-02 13:00:00+07	\N	0.00
19	31	8	2	2026-10-02 21:00:00+07	2026-10-02 22:00:00+07	40.00	t	2026-10-02 22:00:00+07	\N	0.00
20	34	7	1	2026-10-04 10:00:00+07	2026-10-04 11:00:00+07	60.00	t	2026-10-04 11:00:00+07	\N	0.00
21	35	10	2	2026-10-04 17:00:00+07	2026-10-04 18:00:00+07	60.00	t	2026-10-04 18:00:00+07	\N	0.00
22	36	6	1	2026-10-04 14:00:00+07	2026-10-04 15:00:00+07	80.00	t	2026-10-04 15:00:00+07	\N	0.00
23	38	1	2	2026-10-05 16:00:00+07	2026-10-05 17:00:00+07	60.00	t	2026-10-05 17:00:00+07	\N	0.00
24	39	5	2	2026-10-06 15:00:00+07	2026-10-06 16:00:00+07	60.00	t	2026-10-06 16:00:00+07	\N	0.00
25	41	6	2	2026-10-06 15:00:00+07	2026-10-06 16:00:00+07	160.00	t	2026-10-06 16:00:00+07	\N	0.00
26	43	2	2	2026-10-10 14:00:00+07	2026-10-10 15:00:00+07	100.00	t	\N	\N	0.00
27	46	8	1	2026-10-08 19:00:00+07	2026-10-08 20:00:00+07	20.00	t	\N	\N	0.00
28	47	4	1	2026-10-09 11:00:00+07	2026-10-09 12:00:00+07	120.00	t	\N	\N	0.00
29	49	3	2	2026-10-07 12:00:00+07	2026-10-07 14:00:00+07	60.00	f	2026-10-07 11:17:51.199417+07	สภาพปกติ	0.00
30	53	3	2	2026-10-07 14:00:00+07	2026-10-07 15:00:00+07	60.00	f	2026-10-07 11:37:25.888807+07	ปกติ	0.00
31	59	3	2	2026-10-07 15:00:00+07	2026-10-07 16:00:00+07	60.00	f	2026-10-07 11:37:44.711261+07	ปกติ	0.00
32	50	3	2	2026-10-07 16:00:00+07	2026-10-07 18:00:00+07	60.00	f	2026-10-07 11:39:54.169415+07	สภาพปกติ	0.00
33	63	3	2	2026-10-26 08:00:00+07	2026-10-26 10:00:00+07	60.00	f	2026-10-26 04:14:38.853856+07	สภาพปกติ	0.00
34	64	3	2	2026-10-26 10:00:00+07	2026-10-26 12:00:00+07	60.00	f	2026-10-26 04:25:38.343527+07	สภาพปกติ	0.00
\.


--
-- Data for Name: booking_slots; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.booking_slots (id, booking_id, court_id, start_at, end_at, price, active) FROM stdin;
1	1	2	2026-09-23 09:00:00+07	2026-09-23 10:00:00+07	800.00	t
2	2	10	2026-09-23 08:00:00+07	2026-09-23 09:00:00+07	400.00	t
3	3	6	2026-09-23 16:00:00+07	2026-09-23 17:00:00+07	250.00	t
4	4	11	2026-09-23 17:00:00+07	2026-09-23 18:00:00+07	80.00	t
5	5	10	2026-09-24 11:00:00+07	2026-09-24 12:00:00+07	400.00	t
6	6	13	2026-09-24 10:00:00+07	2026-09-24 11:00:00+07	600.00	t
7	7	5	2026-09-24 10:00:00+07	2026-09-24 11:00:00+07	150.00	t
8	8	12	2026-09-24 13:00:00+07	2026-09-24 14:00:00+07	80.00	t
9	9	8	2026-09-25 13:00:00+07	2026-09-25 14:00:00+07	250.00	t
10	10	5	2026-09-25 08:00:00+07	2026-09-25 09:00:00+07	150.00	t
11	11	8	2026-09-25 10:00:00+07	2026-09-25 11:00:00+07	250.00	t
12	12	12	2026-09-26 12:00:00+07	2026-09-26 13:00:00+07	80.00	t
13	13	4	2026-09-26 12:00:00+07	2026-09-26 13:00:00+07	150.00	t
14	14	5	2026-09-26 08:00:00+07	2026-09-26 09:00:00+07	150.00	t
15	15	11	2026-09-27 14:00:00+07	2026-09-27 15:00:00+07	80.00	t
16	16	11	2026-09-27 10:00:00+07	2026-09-27 11:00:00+07	80.00	t
17	17	1	2026-09-27 11:00:00+07	2026-09-27 12:00:00+07	1200.00	t
18	18	8	2026-09-28 11:00:00+07	2026-09-28 12:00:00+07	250.00	t
19	19	2	2026-09-28 14:00:00+07	2026-09-28 15:00:00+07	800.00	t
20	20	2	2026-09-29 13:00:00+07	2026-09-29 14:00:00+07	800.00	t
21	21	11	2026-09-29 18:00:00+07	2026-09-29 19:00:00+07	80.00	t
22	22	4	2026-09-29 10:00:00+07	2026-09-29 11:00:00+07	150.00	t
23	23	2	2026-09-30 23:00:00+07	2026-10-01 00:00:00+07	800.00	t
24	24	1	2026-09-30 14:00:00+07	2026-09-30 15:00:00+07	1200.00	t
25	25	8	2026-09-30 18:00:00+07	2026-09-30 19:00:00+07	250.00	t
26	26	1	2026-10-01 12:00:00+07	2026-10-01 13:00:00+07	1200.00	t
27	27	11	2026-10-01 15:00:00+07	2026-10-01 16:00:00+07	80.00	t
28	28	8	2026-10-01 18:00:00+07	2026-10-01 19:00:00+07	250.00	t
29	29	13	2026-10-02 18:00:00+07	2026-10-02 19:00:00+07	600.00	t
30	30	6	2026-10-02 12:00:00+07	2026-10-02 13:00:00+07	250.00	t
31	31	4	2026-10-02 21:00:00+07	2026-10-02 22:00:00+07	150.00	t
32	32	12	2026-10-03 15:00:00+07	2026-10-03 16:00:00+07	80.00	t
33	33	6	2026-10-03 16:00:00+07	2026-10-03 17:00:00+07	250.00	t
34	34	2	2026-10-04 10:00:00+07	2026-10-04 11:00:00+07	800.00	t
35	35	4	2026-10-04 17:00:00+07	2026-10-04 18:00:00+07	150.00	t
36	36	4	2026-10-04 14:00:00+07	2026-10-04 15:00:00+07	150.00	t
37	37	9	2026-10-05 20:00:00+07	2026-10-05 21:00:00+07	400.00	t
38	38	13	2026-10-05 16:00:00+07	2026-10-05 17:00:00+07	600.00	t
39	39	11	2026-10-06 15:00:00+07	2026-10-06 16:00:00+07	80.00	t
40	40	3	2026-10-06 10:00:00+07	2026-10-06 11:00:00+07	150.00	t
41	41	9	2026-10-06 15:00:00+07	2026-10-06 16:00:00+07	400.00	t
42	42	13	2026-10-06 16:00:00+07	2026-10-06 17:00:00+07	600.00	t
43	43	12	2026-10-10 14:00:00+07	2026-10-10 15:00:00+07	80.00	t
44	44	2	2026-10-09 11:00:00+07	2026-10-09 12:00:00+07	800.00	t
45	45	7	2026-10-10 16:00:00+07	2026-10-10 17:00:00+07	500.00	t
46	46	13	2026-10-08 19:00:00+07	2026-10-08 20:00:00+07	600.00	t
47	47	7	2026-10-09 11:00:00+07	2026-10-09 12:00:00+07	500.00	t
49	49	3	2026-10-07 12:00:00+07	2026-10-07 13:00:00+07	150.00	t
50	49	3	2026-10-07 13:00:00+07	2026-10-07 14:00:00+07	150.00	t
48	48	4	2026-10-10 15:00:00+07	2026-10-10 16:00:00+07	150.00	f
51	53	3	2026-10-07 14:00:00+07	2026-10-07 15:00:00+07	150.00	t
56	59	3	2026-10-07 15:00:00+07	2026-10-07 16:00:00+07	150.00	t
61	50	3	2026-10-07 16:00:00+07	2026-10-07 17:00:00+07	150.00	t
62	50	3	2026-10-07 17:00:00+07	2026-10-07 18:00:00+07	150.00	t
52	56	1	2026-10-08 17:00:00+07	2026-10-08 18:00:00+07	1500.00	f
53	56	1	2026-10-15 17:00:00+07	2026-10-15 18:00:00+07	1500.00	f
54	56	1	2026-10-22 17:00:00+07	2026-10-22 18:00:00+07	1500.00	f
57	57	1	2026-10-08 18:00:00+07	2026-10-08 19:00:00+07	1500.00	f
58	57	1	2026-10-15 18:00:00+07	2026-10-15 19:00:00+07	1500.00	f
59	57	1	2026-10-22 18:00:00+07	2026-10-22 19:00:00+07	1500.00	f
55	52	1	2026-10-08 09:00:00+07	2026-10-08 10:00:00+07	1200.00	f
60	58	1	2026-10-08 10:00:00+07	2026-10-08 11:00:00+07	1200.00	f
64	63	3	2026-10-26 08:00:00+07	2026-10-26 09:00:00+07	150.00	t
65	63	3	2026-10-26 09:00:00+07	2026-10-26 10:00:00+07	150.00	t
67	64	3	2026-10-26 10:00:00+07	2026-10-26 11:00:00+07	150.00	t
68	64	3	2026-10-26 11:00:00+07	2026-10-26 12:00:00+07	150.00	t
89	51	1	2026-10-27 23:00:00+07	2026-10-28 00:00:00+07	1500.00	f
\.


--
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bookings (id, code, user_id, status, confirmed_at, expires_at, checkin_token, reminder_sent_at, created_at, coupon_id, discount) FROM stdin;
1	202609220001	4	completed	2026-09-22 14:00:00+07	\N	7f110a61-439a-4948-a028-3ebf615f3aca	\N	2026-09-22 14:00:00+07	\N	0.00
2	202609220002	6	completed	2026-09-22 06:00:00+07	\N	fb8d41a4-6ec3-4587-81ec-264cf87469f4	\N	2026-09-22 06:00:00+07	\N	0.00
3	202609220003	4	completed	2026-09-22 22:00:00+07	\N	6ab8b599-8729-48bf-8f3b-cdfea35c324a	\N	2026-09-22 22:00:00+07	\N	0.00
4	202609210004	6	completed	2026-09-21 16:00:00+07	\N	8c1acd2d-5949-48de-ba69-c6605fe80132	\N	2026-09-21 16:00:00+07	\N	0.00
5	202609220005	6	completed	2026-09-22 20:00:00+07	\N	6e4944c0-d81c-4816-af6f-84f5c7aa23dd	\N	2026-09-22 20:00:00+07	\N	0.00
6	202609220006	5	completed	2026-09-22 22:00:00+07	\N	d93fa223-c344-45c7-ac66-88114d0905b8	\N	2026-09-22 22:00:00+07	\N	0.00
7	202609230007	6	completed	2026-09-23 02:00:00+07	\N	65ce3204-095d-4a54-bd9d-8f7e25e630ad	\N	2026-09-23 02:00:00+07	\N	0.00
8	202609240008	5	completed	2026-09-24 11:00:00+07	\N	e0c92913-ae0c-4b9d-8399-c7fa2fef268b	\N	2026-09-24 11:00:00+07	\N	0.00
9	202609250009	2	completed	2026-09-25 03:00:00+07	\N	8e917f4e-7b09-4a3b-a32d-f25b51cc2d35	\N	2026-09-25 03:00:00+07	\N	0.00
10	202609240010	6	completed	2026-09-24 20:00:00+07	\N	5783ebd3-3484-45db-8d2a-33f57a3cef7c	\N	2026-09-24 20:00:00+07	\N	0.00
11	202609240011	4	completed	2026-09-24 14:00:00+07	\N	69c3506b-b9fc-46f5-9398-28f3a7f163fb	\N	2026-09-24 14:00:00+07	\N	0.00
12	202609250012	5	completed	2026-09-25 11:00:00+07	\N	e1eda239-556e-4417-97cc-0fc8de60e251	\N	2026-09-25 11:00:00+07	\N	0.00
13	202609250013	3	completed	2026-09-25 02:00:00+07	\N	9c597cc9-0025-498f-a5f8-adade47d70d1	\N	2026-09-25 02:00:00+07	\N	0.00
14	202609250014	3	completed	2026-09-25 03:00:00+07	\N	a9df76de-034f-45b4-a683-1e4b9e116bd4	\N	2026-09-25 03:00:00+07	\N	0.00
15	202609270015	6	completed	2026-09-27 05:00:00+07	\N	2bb88f56-bdff-44e0-a7c9-d265fdc83dbb	\N	2026-09-27 05:00:00+07	\N	0.00
16	202609260016	4	completed	2026-09-26 14:00:00+07	\N	f4feed70-5f74-4b10-90e2-4d065aff66b3	\N	2026-09-26 14:00:00+07	\N	0.00
17	202609260017	5	completed	2026-09-26 09:00:00+07	\N	ab8c0009-bdd5-4b86-b901-fd729e06112d	\N	2026-09-26 09:00:00+07	\N	0.00
18	202609270018	6	completed	2026-09-27 12:00:00+07	\N	e8ed577d-bb9e-4bb5-962e-b688015cc2f2	\N	2026-09-27 12:00:00+07	\N	0.00
19	202609280019	2	completed	2026-09-28 12:00:00+07	\N	eab1987b-0771-4ab7-b52e-e91a8f68f1d8	\N	2026-09-28 12:00:00+07	\N	0.00
20	202609290020	2	completed	2026-09-29 05:00:00+07	\N	33bd036a-c552-4d21-ad09-bdf3455e4d0e	\N	2026-09-29 05:00:00+07	\N	0.00
21	202609290021	5	completed	2026-09-29 07:00:00+07	\N	0eb66a3b-0eeb-4f83-806f-4d84ca484237	\N	2026-09-29 07:00:00+07	\N	0.00
22	202609280022	3	completed	2026-09-28 08:00:00+07	\N	87f3ecfd-c2fc-444b-9d75-7c7134eb83dc	\N	2026-09-28 08:00:00+07	\N	0.00
23	202609300023	6	completed	2026-09-30 18:00:00+07	\N	7e6439e9-0b12-455c-b79d-a28e9479a11b	\N	2026-09-30 18:00:00+07	\N	0.00
24	202609300024	5	completed	2026-09-30 01:00:00+07	\N	65d8188b-cc7f-4e66-bf8d-cf68f26f0a86	\N	2026-09-30 01:00:00+07	\N	0.00
25	202609290025	2	completed	2026-09-29 15:00:00+07	\N	be9abf94-b245-4a35-a750-39c411cb8485	\N	2026-09-29 15:00:00+07	\N	0.00
26	202609300026	5	completed	2026-09-30 02:00:00+07	\N	7d3e247c-5959-4dc4-afc0-6002706122a8	\N	2026-09-30 02:00:00+07	\N	0.00
27	202610010027	6	completed	2026-10-01 04:00:00+07	\N	b1b05a09-a234-4e4d-86f5-bd14164348be	\N	2026-10-01 04:00:00+07	\N	0.00
28	202610010028	4	completed	2026-10-01 02:00:00+07	\N	f7ec648b-cf71-4eba-9244-9910f22e1db4	\N	2026-10-01 02:00:00+07	\N	0.00
29	202610020029	5	completed	2026-10-02 02:00:00+07	\N	2dd7349c-ccad-4d94-be6d-888f4efda3a3	\N	2026-10-02 02:00:00+07	\N	0.00
30	202610010030	6	completed	2026-10-01 09:00:00+07	\N	2835eb0c-df4b-4dfc-86c0-07fa963f166b	\N	2026-10-01 09:00:00+07	\N	0.00
31	202610010031	3	completed	2026-10-01 20:00:00+07	\N	04c63fdf-1f33-4dbb-8589-5e49aecbd4ac	\N	2026-10-01 20:00:00+07	\N	0.00
32	202610020032	2	completed	2026-10-02 15:00:00+07	\N	ffb81a71-271d-44ec-b6a1-273739947ebe	\N	2026-10-02 15:00:00+07	\N	0.00
33	202610020033	4	completed	2026-10-02 04:00:00+07	\N	976b86f1-619f-45b4-9916-2fbc613bb22e	\N	2026-10-02 04:00:00+07	\N	0.00
34	202610030034	6	completed	2026-10-03 14:00:00+07	\N	b2d1dfc2-ecff-474d-a397-1f61ffa62a04	\N	2026-10-03 14:00:00+07	\N	0.00
35	202610040035	6	completed	2026-10-04 03:00:00+07	\N	f2ac8a7b-1aa9-4bae-adfd-860bfe53f1db	\N	2026-10-04 03:00:00+07	\N	0.00
36	202610030036	3	completed	2026-10-03 23:00:00+07	\N	2658d13d-9cf4-45aa-ad38-5db8ef09aed8	\N	2026-10-03 23:00:00+07	\N	0.00
37	202610050037	2	completed	2026-10-05 13:00:00+07	\N	37971747-ddbb-4398-a42f-9374517ad1d9	\N	2026-10-05 13:00:00+07	\N	0.00
38	202610030038	3	completed	2026-10-03 22:00:00+07	\N	b1b5204a-afeb-4dec-a7e5-47704c0a63a4	\N	2026-10-03 22:00:00+07	\N	0.00
39	202610060039	2	completed	2026-10-06 07:00:00+07	\N	306fe0c5-a7dd-40d6-9403-96f4e9c2994f	\N	2026-10-06 07:00:00+07	\N	0.00
40	202610050040	5	completed	2026-10-05 06:00:00+07	\N	c405acc2-3d94-4681-9af8-9ae59414b6cd	\N	2026-10-05 06:00:00+07	\N	0.00
41	202610050041	3	completed	2026-10-05 11:00:00+07	\N	65e34492-f9fc-4015-9314-990c6d551aab	\N	2026-10-05 11:00:00+07	\N	0.00
42	202610060042	2	completed	2026-10-06 01:00:00+07	\N	0139e02d-82f0-4721-951e-1a76afb766d4	\N	2026-10-06 01:00:00+07	\N	0.00
57	202610070057	4	expired	2026-10-07 11:37:47.742204+07	\N	24557677-d60a-4d8b-b0aa-c72e8c8366f7	\N	2026-10-07 11:37:28.896455+07	1	450.00
49	202610070049	2	completed	2026-10-07 11:17:43.470426+07	\N	ef8a5258-cd1f-4f65-90ea-5b2d0c4ae111	\N	2026-10-07 11:17:39.817552+07	1	36.00
48	202610070048	5	expired	2026-10-07 10:47:35.264+07	\N	61da5575-427e-4a32-8a7e-3b2387f1b48d	\N	2026-10-07 10:47:35.264+07	\N	0.00
54	202610070054	3	cart	\N	\N	\N	\N	2026-10-07 11:37:23.494719+07	\N	0.00
55	202610070055	7	cart	\N	\N	\N	\N	2026-10-07 11:37:24.135826+07	\N	0.00
53	202610070053	7	completed	2026-10-07 11:37:24.117631+07	\N	14eb5a69-3b61-4411-8657-49fd258567ea	\N	2026-10-07 11:37:22.873075+07	\N	0.00
61	202610070061	4	cart	\N	\N	\N	\N	2026-10-07 11:37:47.75737+07	\N	0.00
60	202610070060	8	cart	\N	\N	\N	\N	2026-10-07 11:37:42.943737+07	\N	0.00
59	202610070059	8	completed	2026-10-07 11:37:42.925219+07	\N	42718069-50bd-48c4-bb87-c5ca264e2bec	\N	2026-10-07 11:37:41.689154+07	\N	0.00
62	202610070062	6	cart	\N	\N	\N	\N	2026-10-07 11:37:51.655415+07	\N	0.00
50	202610070050	2	completed	2026-10-07 11:39:46.404638+07	\N	2487f2ea-9807-4af5-bf36-af6767e31f8a	\N	2026-10-07 11:17:43.485989+07	1	36.00
56	202610070056	4	expired	2026-10-07 11:37:28.880814+07	\N	e8b28859-7090-4bb0-8ba2-68d7d619ee6f	\N	2026-10-07 11:37:27.599517+07	1	450.00
52	202610070052	6	expired	2026-10-07 11:37:33.579229+07	\N	00df9081-3768-4516-9867-02e137d96bc9	\N	2026-10-07 11:36:36.023222+07	\N	0.00
58	202610070058	6	expired	2026-10-07 11:37:51.642239+07	\N	ede9ddf3-0971-4e86-8ad5-fea2ca4ec3fb	\N	2026-10-07 11:37:33.592375+07	\N	0.00
43	202610070043	5	completed	2026-10-07 10:47:35.25+07	\N	0026e2ac-33de-4ac3-bd04-5cb69ce0652b	\N	2026-10-07 10:47:35.25+07	\N	0.00
44	202610070044	3	completed	2026-10-07 10:00:00+07	\N	656cc207-63f0-416a-bbca-0f73a5cbd249	\N	2026-10-07 10:00:00+07	\N	0.00
45	202610070045	5	completed	2026-10-07 10:47:35.255+07	\N	0fca21a1-e5c1-4872-ab67-bcec783040ef	\N	2026-10-07 10:47:35.255+07	\N	0.00
46	202610070046	3	completed	2026-10-07 10:47:35.258+07	\N	89d33e62-e701-4a08-bb59-d928c2319e64	\N	2026-10-07 10:47:35.258+07	\N	0.00
63	202610070063	2	completed	2026-10-26 04:14:30.707814+07	\N	f84a92bf-3fdf-47aa-889e-53e9201cd363	\N	2026-10-07 11:39:46.422161+07	1	36.00
65	202610260065	2	cart	\N	\N	\N	\N	2026-10-26 04:25:30.297746+07	\N	0.00
64	202610260064	2	completed	2026-10-26 04:25:30.280922+07	\N	41d0e1ba-49a1-4fbf-b6b6-6bd15f3b81c4	\N	2026-10-26 04:14:30.731323+07	1	36.00
47	202610070047	2	completed	2026-10-07 10:47:35.261+07	\N	c01a9821-360a-4129-ba16-4ef49b5f1d63	\N	2026-10-07 10:47:35.261+07	\N	0.00
66	202610270066	1	cart	\N	\N	\N	\N	2026-10-27 22:27:49.824386+07	\N	0.00
51	202610070051	1	cancelled	2026-10-27 22:27:49.802702+07	\N	39d989c4-f2eb-4874-96b8-2344cf89e120	\N	2026-10-07 11:17:45.454786+07	\N	0.00
\.


--
-- Data for Name: coupons; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.coupons (id, code, percent_off, amount_off, min_total, max_uses, used_count, expires_at, is_active, created_at, name, per_user_limit) FROM stdin;
2	BAHT50	\N	50.00	0.00	100	0	\N	t	2026-10-07 11:17:35.078638+07	ลดทันที 50 บาท	\N
1	WELCOME10	10	\N	300.00	\N	6	\N	t	2026-10-07 11:17:35.078638+07	ต้อนรับสมาชิกใหม่	\N
\.


--
-- Data for Name: courts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.courts (id, sport_id, name, description, price_per_hour, open_hour, close_hour, image_url, is_active, created_at, peak_price_per_hour, peak_from_hour) FROM stdin;
3	2	คอร์ทแบด 1	พื้นยาง PU มาตรฐาน BWF ไฟไม่แยงตา	150.00	8	22	/photos/courts/03.jpg	t	2026-10-07 11:17:35.078638+07	\N	\N
4	2	คอร์ทแบด 2	พื้นยาง PU มาตรฐาน BWF ไฟไม่แยงตา	150.00	8	22	/photos/courts/04.jpg	t	2026-10-07 11:17:35.078638+07	\N	\N
5	2	คอร์ทแบด 3	คอร์ทริมหน้าต่าง อากาศถ่ายเท	150.00	8	22	/photos/courts/05.jpg	t	2026-10-07 11:17:35.078638+07	\N	\N
6	2	คอร์ทแบด 4 (VIP แอร์)	ห้องแอร์ เหมาะกับการแข่งขัน	250.00	8	22	/photos/courts/06.jpg	t	2026-10-07 11:17:35.078638+07	\N	\N
7	3	สนามบาสในร่ม	พื้นไม้ปาร์เก้ ห่วงปรับระดับได้	500.00	8	22	/photos/courts/07.jpg	t	2026-10-07 11:17:35.078638+07	\N	\N
8	3	สนามบาสกลางแจ้ง	สนามครึ่งคอร์ท เหมาะกับ 3x3	250.00	6	21	/photos/courts/08.jpg	t	2026-10-07 11:17:35.078638+07	\N	\N
11	5	โต๊ะปิงปอง 1	โต๊ะมาตรฐาน ITTF	80.00	8	22	/photos/courts/11.jpg	t	2026-10-07 11:17:35.078638+07	\N	\N
12	5	โต๊ะปิงปอง 2	โต๊ะมาตรฐาน ITTF	80.00	8	22	/photos/courts/12.jpg	t	2026-10-07 11:17:35.078638+07	\N	\N
13	6	สนามวอลเลย์บอลในร่ม	พื้นยางสังเคราะห์ ตาข่ายปรับความสูงได้	600.00	8	22	/photos/courts/13.jpg	t	2026-10-07 11:17:35.078638+07	\N	\N
1	1	สนามหญ้าเทียม A (7 คน)	หญ้าเทียมเกรด FIFA มีไฟส่องสว่างกลางคืน ห้องอาบน้ำในตัว	1200.00	9	24	/photos/courts/01.jpg	t	2026-10-07 11:17:35.078638+07	1500.00	17
2	1	สนามหญ้าเทียม B (5 คน)	สนามฟุตซอลกลางแจ้ง หลังคาโดม เล่นได้แม้ฝนตก	800.00	9	24	/photos/courts/02.jpg	t	2026-10-07 11:17:35.078638+07	1000.00	17
9	4	คอร์ทเทนนิส 1 (Hard court)	พื้นฮาร์ดคอร์ทมาตรฐาน	400.00	6	22	/photos/courts/09.jpg	t	2026-10-07 11:17:35.078638+07	500.00	17
10	4	คอร์ทเทนนิส 2 (Hard court)	พื้นฮาร์ดคอร์ทมาตรฐาน	400.00	6	22	/photos/courts/10.jpg	t	2026-10-07 11:17:35.078638+07	500.00	17
16	13	สนามฟุตซอลในร่ม 1	พื้นยางสังเคราะห์มาตรฐานฟุตซอล ประตูขนาดจริง	700.00	9	24	/photos/courts/14.jpg	t	2026-10-26 16:14:46.700052+07	\N	\N
17	13	สนามฟุตซอลในร่ม 2	พื้นยางสังเคราะห์มาตรฐานฟุตซอล ประตูขนาดจริง	700.00	9	24	/photos/courts/15.jpg	t	2026-10-26 16:14:46.700052+07	\N	\N
18	14	สระว่ายน้ำ เลน 1-2	สระ 25 เมตร ระบบน้ำเกลือ จองครั้งละ 2 เลน	200.00	6	21	/photos/courts/16.jpg	t	2026-10-26 16:14:46.700052+07	\N	\N
19	14	สระว่ายน้ำ เลน 3-4	สระ 25 เมตร ระบบน้ำเกลือ จองครั้งละ 2 เลน	200.00	6	21	/photos/courts/17.jpg	t	2026-10-26 16:14:46.700052+07	\N	\N
20	15	เวทีมวยไทย	เวทีขนาดมาตรฐาน พร้อมกระสอบทราย 6 ลูก	500.00	9	22	/photos/courts/18.jpg	t	2026-10-26 16:14:46.700052+07	\N	\N
21	16	โต๊ะสนุกเกอร์ 1	โต๊ะ 12 ฟุต ผ้าสักหลาดใหม่	150.00	10	24	/photos/courts/19.jpg	t	2026-10-26 16:14:46.700052+07	\N	\N
22	16	โต๊ะสนุกเกอร์ 2	โต๊ะ 12 ฟุต ผ้าสักหลาดใหม่	150.00	10	24	/photos/courts/20.jpg	t	2026-10-26 16:14:46.700052+07	\N	\N
23	17	เลนโบว์ลิ่ง 1-2	เลนมาตรฐาน ระบบนับคะแนนอัตโนมัติ	400.00	10	24	/photos/courts/21.jpg	t	2026-10-26 16:14:46.700052+07	\N	\N
24	17	เลนโบว์ลิ่ง 3-4	เลนมาตรฐาน ระบบนับคะแนนอัตโนมัติ	400.00	10	24	/photos/courts/22.jpg	t	2026-10-26 16:14:46.700052+07	\N	\N
25	18	ไดรฟ์กอล์ฟ ช่อง 1	ช่องตีระยะ 250 หลา รวมลูก 1 ตะกร้า	250.00	7	22	/photos/courts/23.jpg	t	2026-10-26 16:14:46.700052+07	\N	\N
26	18	ไดรฟ์กอล์ฟ ช่อง 2	ช่องตีระยะ 250 หลา รวมลูก 1 ตะกร้า	250.00	7	22	/photos/courts/24.jpg	t	2026-10-26 16:14:46.700052+07	\N	\N
27	19	ลานยิงธนู	ระยะ 18 และ 30 เมตร เป้ามาตรฐาน	300.00	9	20	/photos/courts/25.jpg	t	2026-10-26 16:14:46.700052+07	\N	\N
28	20	ผนังปีนผา	ผนังสูง 12 เมตร 8 เส้นทาง มีเจ้าหน้าที่คุมเชือก	350.00	10	21	/photos/courts/26.jpg	t	2026-10-26 16:14:46.700052+07	\N	\N
29	21	สนามฮอกกี้หญ้าเทียม	หญ้าเทียมสำหรับฮอกกี้ ฉีดน้ำก่อนเล่น	900.00	7	21	/photos/courts/27.jpg	t	2026-10-26 16:14:46.700052+07	\N	\N
30	22	กรงตีเบสบอล	กรงตีพร้อมเครื่องขว้างลูกปรับความเร็วได้	300.00	9	21	/photos/courts/28.jpg	t	2026-10-26 16:14:46.700052+07	\N	\N
31	23	สนามรักบี้	สนามหญ้าจริงขนาดมาตรฐาน มีไฟกลางคืน	1500.00	7	22	/photos/courts/29.jpg	t	2026-10-26 16:14:46.700052+07	\N	\N
32	24	ลานฟันดาบ (2 ลาน)	พื้นลานมาตรฐานพร้อมเครื่องนับแต้ม	300.00	10	21	/photos/courts/30.jpg	t	2026-10-26 16:14:46.700052+07	\N	\N
33	25	ห้องฟิตเนสส่วนตัว	ห้องเวทและคาร์ดิโอสำหรับกลุ่มไม่เกิน 4 คน	200.00	6	22	/photos/courts/31.jpg	t	2026-10-26 16:14:46.700052+07	\N	\N
\.


--
-- Data for Name: emails; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.emails (id, user_id, booking_id, kind, to_address, subject, html, status, error, read_at, created_at) FROM stdin;
1	2	49	confirmed	member@sporthub.local	[SportHub] ยืนยันการจอง #202610070049 — กรุณาชำระเงินภายใน 15 นาที	<div style="font-family:sans-serif;max-width:560px">\n  <h2 style="color:#0f766e">ได้รับการจองแล้ว</h2>\n  <p>สวัสดีคุณ สมชาย ใจดี</p>\n  <p>กรุณาสแกน QR PromptPay และแนบสลิปภายใน 15 นาที ไม่เช่นนั้นการจองจะถูกยกเลิกอัตโนมัติ</p>\n  <p><b>เลขที่การจอง:</b> 202610070049<br><b>ยอดรวม:</b> 324 บาท</p>\n  <ul><li>คอร์ทแบด 1 — 7 ต.ค. 2569 12:00 - 13:00</li><li>คอร์ทแบด 1 — 7 ต.ค. 2569 13:00 - 14:00</li><li>ไม้แบดมินตัน × 2 — 7 ต.ค. 2569 12:00 - 14:00</li></ul>\n  <p><a href="http://localhost:5173/bookings/49">ดูรายละเอียดการจอง</a></p>\n  <p style="color:#64748b;font-size:12px">SportHub — ระบบจองสนามกีฬาและยืมอุปกรณ์</p></div>	web	\N	\N	2026-10-07 11:17:43.482817+07
2	2	49	approved	member@sporthub.local	[SportHub] ชำระเงินสำเร็จ #202610070049	<div style="font-family:sans-serif;max-width:560px">\n  <h2 style="color:#0f766e">ชำระเงินสำเร็จ</h2>\n  <p>สวัสดีคุณ สมชาย ใจดี</p>\n  <p>แสดง QR นี้ที่เคาน์เตอร์เพื่อเช็คอิน</p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAAAklEQVR4AewaftIAAAa9SURBVO3BgY0bSRAEwawG/Xe5/i2YFTC3oqTOiPR/SFppkLTWIGmtQdJag6S1BklrDZLWGiStNUha68MvSMIGbXlTEp605SQJN9ryJAknbbmRhLe15SQJG7TlZJC01iBprUHSWoOktQZJaw2S1hokrfXhB7TlT5eEtyXhpC232nKShJMk3ErCSVtuteUkCW9ry58uCTcGSWsNktYaJK01SFprkLTWIGmtQdJaH36DJLytLW9Lwo0kPGnLSRJutOVWEm605V+QhLe15U2DpLUGSWsNktYaJK01SFprkLTWIGmtQdJaH/Rj2nKShLe15SQJT9py0paTJNxqy0lbdG+QtNYgaa1B0lqDpLUGSWsNktYaJK31QT8mCbeS8Ka23ErC25Jwoy16Nkhaa5C01iBprUHSWoOktQZJaw2S1vrwG7Rlg7acJOFvkISTtgja8rcbJK01SFprkLTWIGmtQdJag6S1BklrffgBSdDPaMtJEm4k4UlbTpJw0paTJDxpy0kSTtpyKwn/ukHSWoOktQZJaw2S1hokrTVIWmuQtNYgaa0Pv6AtepaEf0ES3tSWW2250RbBIGmtQdJag6S1BklrDZLWGiStNUha68MvSMJJW06S8Ddoy0lbbiTh29rytiTcastJEk7acpKEv0Fb3jRIWmuQtNYgaa1B0lqDpLUGSWsNktb68AOScNKWJ0k4actJEk7a8iQJb2rL25LwtractOVWEk7acpKEb2vLrSTcaMvJIGmtQdJag6S1BklrDZLWGiStNUha68MPaMtJEt7WlpMkPGnLjSS8rS0nSfgXtOUkCSdtuZWEG0k4acuTtrxpkLTWIGmtQdJag6S1BklrDZLWGiStNUha68M/Igknbfm2JNxqy422PEnCn64tJ0m41ZaTJJy05VYSTtpyY5C01iBprUHSWoOktQZJaw2S1hokrZX+j0tJuNWWNyXhSVtuJOFWW96UhG9ry5MkvKktT5Jw0paTJHxbW04GSWsNktYaJK01SFprkLTWIGmtQdJaH35BEr4tCTfacisJJ205ScK3teVJEk7aciMJt9pykoSTJDxpy0kSbrTlVhJuDJLWGiStNUhaa5C01iBprUHSWoOktT4skYRbbTlJwq0knLTl25LwtracJOGkLSdJ+Bsk4aQtNwZJaw2S1hokrTVIWmuQtNYgaa1B0lqDpLU+/IK2nCThpC1va8vbkvC3S8Lb2nKShG9ry5Mk3GjL25Jw0paTQdJag6S1BklrDZLWGiStNUhaa5C0Vvo/LiXhbW25kYRbbbmRhCdt+bYknLTlJAlva8tJEk7a8rYk3GrLmwZJaw2S1hokrTVIWmuQtNYgaa1B0loffkESbrTl29ryJAlvasuTJJy05SQJt9pykoSTttxKwo22nCThbW25lYQbbTkZJK01SFprkLTWIGmtQdJag6S1BklrffgBbbmVhBttOUnC25LwL0jCjSTcastJEk7actKWJ0k4acuNJDxpy5sGSWsNktYaJK01SFprkLTWIGmtQdJag6S1PvwGSXjSlpMk3GjLkyScJOHbknCjLU+ScNKWG0l4WxJO2vKkLSdJOGnLSVu+bZC01iBprUHSWoOktQZJaw2S1hokrfXhD5GENyXhVlveloSTttxIwtuScNKWb0vC25Jwqy1vGiStNUhaa5C01iBprUHSWoOktQZJa6X/Q78kCTfa8i9IwklbTpLwtra8LQk32vIkCTfacjJIWmuQtNYgaa1B0lqDpLUGSWsNktb68AuSsEFbTtpykoRbSbjRlltJOGnLjbY8ScKbkvCkLd/WljcNktYaJK01SFprkLTWIGmtQdJag6S1BklrffgBbfnTJeFWEm4k4Ulb3pSEW0k4actJEp605SQJN9rytrb86QZJaw2S1hokrTVIWmuQtNYgaa1B0loffoMkvK0t39aWkyTcSsJJW07a8iQJN5LwbUn4tiS8rS03BklrDZLWGiStNUhaa5C01iBprUHSWh+0ShKetOVv15Y/XRJuJeGkLSeDpLUGSWsNktYaJK01SFprkLTWIGmtD/oxSThpy98gCTfacpKEW205ScK3teWkLU+ScNKWG4OktQZJaw2S1hokrTVIWmuQtNYgaa1B0loffoO2/AvacpKEP11b/gVJOGnLrST86wZJaw2S1hokrTVIWmuQtNYgaa1B0loffkASNkjCSVtuJeFGEk7a8iQJJ205ScJJW96WhLe15UYSnrTlTYOktQZJaw2S1hokrTVIWmuQtNYgaa30f0haaZC01iBprUHSWoOktQZJaw2S1hokrfUf6fgaSX2m8+IAAAAASUVORK5CYII=" width="200" alt="QR เช็คอิน">\n  <p><b>เลขที่การจอง:</b> 202610070049<br><b>ยอดรวม:</b> 324 บาท</p>\n  <ul><li>คอร์ทแบด 1 — 7 ต.ค. 2569 12:00 - 13:00</li><li>คอร์ทแบด 1 — 7 ต.ค. 2569 13:00 - 14:00</li><li>ไม้แบดมินตัน × 2 — 7 ต.ค. 2569 12:00 - 14:00</li></ul>\n  <p><a href="http://localhost:5173/bookings/49">ดูรายละเอียดการจอง</a></p>\n  <p style="color:#64748b;font-size:12px">SportHub — ระบบจองสนามกีฬาและยืมอุปกรณ์</p></div>	web	\N	2026-10-07 11:18:02.834826+07	2026-10-07 11:17:46.321355+07
3	5	48	cancelled	pim@sporthub.local	[SportHub] การจอง #202610070048 ถูกยกเลิก	<div style="font-family:sans-serif;max-width:560px">\n  <h2 style="color:#0f766e">การจองถูกยกเลิก</h2>\n  <p>สวัสดีคุณ พิมพ์ชนก ตีแบด</p>\n  <p>หมดเวลาชำระเงิน ระบบยกเลิกการจองให้อัตโนมัติ</p>\n  <p><b>เลขที่การจอง:</b> 202610070048<br><b>ยอดรวม:</b> 150 บาท</p>\n  <ul><li>คอร์ทแบด 2 — 10 ต.ค. 2569 15:00 - 16:00</li></ul>\n  <p><a href="http://localhost:5173/bookings/48">ดูรายละเอียดการจอง</a></p>\n  <p style="color:#64748b;font-size:12px">SportHub — ระบบจองสนามกีฬาและยืมอุปกรณ์</p></div>	web	\N	\N	2026-10-07 11:33:09.562364+07
4	7	53	confirmed	e2e.1791347842473@example.com	[SportHub] ยืนยันการจอง #202610070053 — กรุณาชำระเงินภายใน 15 นาที	<div style="font-family:sans-serif;max-width:560px">\n  <h2 style="color:#0f766e">ได้รับการจองแล้ว</h2>\n  <p>สวัสดีคุณ ทดสอบ อีทูอี</p>\n  <p>กรุณาสแกน QR PromptPay และแนบสลิปภายใน 15 นาที ไม่เช่นนั้นการจองจะถูกยกเลิกอัตโนมัติ</p>\n  <p><b>เลขที่การจอง:</b> 202610070053<br><b>ยอดรวม:</b> 210 บาท</p>\n  <ul><li>คอร์ทแบด 1 — 7 ต.ค. 2569 14:00 - 15:00</li><li>ไม้แบดมินตัน × 2 — 7 ต.ค. 2569 14:00 - 15:00</li></ul>\n  <p><a href="http://localhost:5173/bookings/53">ดูรายละเอียดการจอง</a></p>\n  <p style="color:#64748b;font-size:12px">SportHub — ระบบจองสนามกีฬาและยืมอุปกรณ์</p></div>	web	\N	\N	2026-10-07 11:37:24.13206+07
5	7	53	approved	e2e.1791347842473@example.com	[SportHub] ชำระเงินสำเร็จ #202610070053	<div style="font-family:sans-serif;max-width:560px">\n  <h2 style="color:#0f766e">ชำระเงินสำเร็จ</h2>\n  <p>สวัสดีคุณ ทดสอบ อีทูอี</p>\n  <p>แสดง QR นี้ที่เคาน์เตอร์เพื่อเช็คอิน</p><img src="data:image/png;base64,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" width="200" alt="QR เช็คอิน">\n  <p><b>เลขที่การจอง:</b> 202610070053<br><b>ยอดรวม:</b> 210 บาท</p>\n  <ul><li>คอร์ทแบด 1 — 7 ต.ค. 2569 14:00 - 15:00</li><li>ไม้แบดมินตัน × 2 — 7 ต.ค. 2569 14:00 - 15:00</li></ul>\n  <p><a href="http://localhost:5173/bookings/53">ดูรายละเอียดการจอง</a></p>\n  <p style="color:#64748b;font-size:12px">SportHub — ระบบจองสนามกีฬาและยืมอุปกรณ์</p></div>	web	\N	\N	2026-10-07 11:37:24.839984+07
6	4	56	confirmed	anan@sporthub.local	[SportHub] ยืนยันการจอง #202610070056 — กรุณาชำระเงินภายใน 15 นาที	<div style="font-family:sans-serif;max-width:560px">\n  <h2 style="color:#0f766e">ได้รับการจองแล้ว</h2>\n  <p>สวัสดีคุณ อนันต์ วิ่งเร็ว</p>\n  <p>กรุณาสแกน QR PromptPay และแนบสลิปภายใน 15 นาที ไม่เช่นนั้นการจองจะถูกยกเลิกอัตโนมัติ</p>\n  <p><b>เลขที่การจอง:</b> 202610070056<br><b>ยอดรวม:</b> 4,050 บาท</p>\n  <ul><li>สนามหญ้าเทียม A (7 คน) — 8 ต.ค. 2569 17:00 - 18:00</li><li>สนามหญ้าเทียม A (7 คน) — 15 ต.ค. 2569 17:00 - 18:00</li><li>สนามหญ้าเทียม A (7 คน) — 22 ต.ค. 2569 17:00 - 18:00</li></ul>\n  <p><a href="http://localhost:5173/bookings/56">ดูรายละเอียดการจอง</a></p>\n  <p style="color:#64748b;font-size:12px">SportHub — ระบบจองสนามกีฬาและยืมอุปกรณ์</p></div>	web	\N	\N	2026-10-07 11:37:28.893063+07
7	6	52	confirmed	krit@sporthub.local	[SportHub] ยืนยันการจอง #202610070052 — กรุณาชำระเงินภายใน 20 นาที	<div style="font-family:sans-serif;max-width:560px">\n  <h2 style="color:#0f766e">ได้รับการจองแล้ว</h2>\n  <p>สวัสดีคุณ กฤษดา ชู้ตไกล</p>\n  <p>กรุณาสแกน QR PromptPay และแนบสลิปภายใน 20 นาที ไม่เช่นนั้นการจองจะถูกยกเลิกอัตโนมัติ</p>\n  <p><b>เลขที่การจอง:</b> 202610070052<br><b>ยอดรวม:</b> 1,200 บาท</p>\n  <ul><li>สนามหญ้าเทียม A (7 คน) — 8 ต.ค. 2569 09:00 - 10:00</li></ul>\n  <p><a href="http://localhost:5173/bookings/52">ดูรายละเอียดการจอง</a></p>\n  <p style="color:#64748b;font-size:12px">SportHub — ระบบจองสนามกีฬาและยืมอุปกรณ์</p></div>	web	\N	2026-10-07 11:37:33.678204+07	2026-10-07 11:37:33.588633+07
8	8	59	confirmed	e2e.1791347861254@example.com	[SportHub] ยืนยันการจอง #202610070059 — กรุณาชำระเงินภายใน 15 นาที	<div style="font-family:sans-serif;max-width:560px">\n  <h2 style="color:#0f766e">ได้รับการจองแล้ว</h2>\n  <p>สวัสดีคุณ ทดสอบ อีทูอี</p>\n  <p>กรุณาสแกน QR PromptPay และแนบสลิปภายใน 15 นาที ไม่เช่นนั้นการจองจะถูกยกเลิกอัตโนมัติ</p>\n  <p><b>เลขที่การจอง:</b> 202610070059<br><b>ยอดรวม:</b> 210 บาท</p>\n  <ul><li>คอร์ทแบด 1 — 7 ต.ค. 2569 15:00 - 16:00</li><li>ไม้แบดมินตัน × 2 — 7 ต.ค. 2569 15:00 - 16:00</li></ul>\n  <p><a href="http://localhost:5173/bookings/59">ดูรายละเอียดการจอง</a></p>\n  <p style="color:#64748b;font-size:12px">SportHub — ระบบจองสนามกีฬาและยืมอุปกรณ์</p></div>	web	\N	\N	2026-10-07 11:37:42.939064+07
9	8	59	approved	e2e.1791347861254@example.com	[SportHub] ชำระเงินสำเร็จ #202610070059	<div style="font-family:sans-serif;max-width:560px">\n  <h2 style="color:#0f766e">ชำระเงินสำเร็จ</h2>\n  <p>สวัสดีคุณ ทดสอบ อีทูอี</p>\n  <p>แสดง QR นี้ที่เคาน์เตอร์เพื่อเช็คอิน</p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAAAklEQVR4AewaftIAAAbBSURBVO3BgY0bSRAEwawG/Xe5XhbMPjBa8aTOiPQXJK00SFprkLTWIGmtQdJag6S1BklrDZLWGiSt9eF/SMIGbfm2JPx0bTlJwklbvi0JG7TlZJC01iBprUHSWoOktQZJaw2S1hokrfXhN2jLT5eEb0vCrbacJOFtSbiRhLe15VZbfrok3BgkrTVIWmuQtNYgaa1B0lqDpLUGSWt9+AOS8La2vC0JJ215WxJutOVJEk7acpKEW2356ZLwtra8aZC01iBprUHSWoOktQZJaw2S1hokrTVIWuuDfpskvK0tN5LwL0jCSVv0bJC01iBprUHSWoOktQZJaw2S1hokrfVBv01bTpLwpC1vasuTJJwk4aQtt5Jw0hbdGyStNUhaa5C01iBprUHSWoOktQZJa334A9oiaMuTJNxoy622vCkJ/4K2/O0GSWsNktYaJK01SFprkLTWIGmtQdJaH36DJOhZEp605SQJN5LwpC0nSThpy622nCThpC23kvCvGyStNUhaa5C01iBprUHSWoOktQZJaw2S1vrwP7RFz5Jw0pYnSfjbJeGkLU+S8Ka2CAZJaw2S1hokrTVIWmuQtNYgaa1B0lrpLzxIwklbTpLwN2jLjSTcastJEk7a8m1JuNWWkySctOUkCX+DtrxpkLTWIGmtQdJag6S1BklrDZLWGiStlf7CXyAJN9pyKwknbbmVhJ+uLYIknLTlJAlva8vJIGmtQdJag6S1BklrDZLWGiStNUha68P/kIS3teWkLSdJOEnCk7bofUl4W1tOkvCkLSdt+ba23BgkrTVIWmuQtNYgaa1B0lqDpLUGSWsNktb68JdIwklb3taWG0n4trY8ScKNJLytLSdJOGnLt7XlSRJOknDSlpNB0lqDpLUGSWsNktYaJK01SFprkLTWhyWScKstN9rybUl4W1tOknArCW9Lwo22vK0tNwZJaw2S1hokrTVIWmuQtNYgaa1B0loffoO2nCThSRLe1Ja3JeGkLbeScNKWk7Y8ScKNJJy05duS8KQtN5Jwqy1vGiStNUhaa5C01iBprUHSWoOktQZJa334H9rytrbcSMK3teVWEr6tLSdJOGnLSRKetOVGEk7a8ra2nCThVhJO2nIySFprkLTWIGmtQdJag6S1BklrDZLWGiStlf7CgyR8W1veloSTtpwk4dvacpKEW235tiSctOVWEm605VYSbrTlZJC01iBprUHSWoOktQZJaw2S1hokrfXhD2jLkyS8KQlP2nKShJO23ErCm9ryJAknSThpy0kS3paEb0vCSVtuteXGIGmtQdJag6S1BklrDZLWGiStNUha68Nv0JaTJNxKwklbTtryJAknbTlJwtvacpKEW225kYSTtvwLkvC2tpwk4aQtJ4OktQZJaw2S1hokrTVIWmuQtNYgaa0PSyThSVve1BZBEp605SQJb2vLSVtuJOHbBklrDZLWGiStNUhaa5C01iBprUHSWoOktT78AW25lYSTJJy05W1tuZWEN7XlbW15W1tOkvC2JJy05acbJK01SFprkLTWIGmtQdJag6S1BklrffgDkvCkLW9KwpO2nCThpC232vKmJLytLSdJeNKWkyS8LQk3knDSlidJeNMgaa1B0lqDpLUGSWsNktYaJK01SFor/QX9L0k4actJEp605SQJJ235tiSctOVJEm605W1JOGnLSRKetOVNg6S1BklrDZLWGiStNUhaa5C01iBprQ//QxI2aMtJW06ScNKWW215WxLelIRvS8KTtnxbEk7acmOQtNYgaa1B0lqDpLUGSWsNktYaJK01SFrrw2/Qlp8uCbeS8LYknLTlRhJuteVGEp605SQJN9ryL0jCSVtOBklrDZLWGiStNUhaa5C01iBprUHSWh/+gCS8rS3f1pZbbTlJwklbTtryJAknSfjpkvBtSThpy5MknLTlxiBprUHSWoOktQZJaw2S1hokrTVIWuuD/iptuZGEJ235tiSctOUkCSdteZKEk7bcSMK3DZLWGiStNUhaa5C01iBprUHSWoOktT7ot0nCSVueJOGkLSdJOGnLkyR8W1tutOVWW06ScNKWk7Y8ScKbBklrDZLWGiStNUhaa5C01iBprUHSWoOktT78AW35F7TlJAknSXjSlpMknLTlbW05ScKtJNxoy60kfFtb3jRIWmuQtNYgaa1B0lqDpLUGSWsNktZKf+FBEjZoy0kSTtpyKwnf1paTJJy05SQJT9pykoS3teUkCd/WlhuDpLUGSWsNktYaJK01SFprkLTWIGmt9BckrTRIWmuQtNYgaa1B0lqDpLUGSWsNktb6DyoqNB0WdNJKAAAAAElFTkSuQmCC" width="200" alt="QR เช็คอิน">\n  <p><b>เลขที่การจอง:</b> 202610070059<br><b>ยอดรวม:</b> 210 บาท</p>\n  <ul><li>คอร์ทแบด 1 — 7 ต.ค. 2569 15:00 - 16:00</li><li>ไม้แบดมินตัน × 2 — 7 ต.ค. 2569 15:00 - 16:00</li></ul>\n  <p><a href="http://localhost:5173/bookings/59">ดูรายละเอียดการจอง</a></p>\n  <p style="color:#64748b;font-size:12px">SportHub — ระบบจองสนามกีฬาและยืมอุปกรณ์</p></div>	web	\N	\N	2026-10-07 11:37:43.654388+07
10	4	57	confirmed	anan@sporthub.local	[SportHub] ยืนยันการจอง #202610070057 — กรุณาชำระเงินภายใน 15 นาที	<div style="font-family:sans-serif;max-width:560px">\n  <h2 style="color:#0f766e">ได้รับการจองแล้ว</h2>\n  <p>สวัสดีคุณ อนันต์ วิ่งเร็ว</p>\n  <p>กรุณาสแกน QR PromptPay และแนบสลิปภายใน 15 นาที ไม่เช่นนั้นการจองจะถูกยกเลิกอัตโนมัติ</p>\n  <p><b>เลขที่การจอง:</b> 202610070057<br><b>ยอดรวม:</b> 4,050 บาท</p>\n  <ul><li>สนามหญ้าเทียม A (7 คน) — 8 ต.ค. 2569 18:00 - 19:00</li><li>สนามหญ้าเทียม A (7 คน) — 15 ต.ค. 2569 18:00 - 19:00</li><li>สนามหญ้าเทียม A (7 คน) — 22 ต.ค. 2569 18:00 - 19:00</li></ul>\n  <p><a href="http://localhost:5173/bookings/57">ดูรายละเอียดการจอง</a></p>\n  <p style="color:#64748b;font-size:12px">SportHub — ระบบจองสนามกีฬาและยืมอุปกรณ์</p></div>	web	\N	\N	2026-10-07 11:37:47.753966+07
11	6	58	confirmed	krit@sporthub.local	[SportHub] ยืนยันการจอง #202610070058 — กรุณาชำระเงินภายใน 20 นาที	<div style="font-family:sans-serif;max-width:560px">\n  <h2 style="color:#0f766e">ได้รับการจองแล้ว</h2>\n  <p>สวัสดีคุณ กฤษดา ชู้ตไกล</p>\n  <p>กรุณาสแกน QR PromptPay และแนบสลิปภายใน 20 นาที ไม่เช่นนั้นการจองจะถูกยกเลิกอัตโนมัติ</p>\n  <p><b>เลขที่การจอง:</b> 202610070058<br><b>ยอดรวม:</b> 1,200 บาท</p>\n  <ul><li>สนามหญ้าเทียม A (7 คน) — 8 ต.ค. 2569 10:00 - 11:00</li></ul>\n  <p><a href="http://localhost:5173/bookings/58">ดูรายละเอียดการจอง</a></p>\n  <p style="color:#64748b;font-size:12px">SportHub — ระบบจองสนามกีฬาและยืมอุปกรณ์</p></div>	web	\N	2026-10-07 11:37:51.739014+07	2026-10-07 11:37:51.65223+07
12	2	50	confirmed	member@sporthub.local	[SportHub] ยืนยันการจอง #202610070050 — กรุณาชำระเงินภายใน 15 นาที	<div style="font-family:sans-serif;max-width:560px">\n  <h2 style="color:#0f766e">ได้รับการจองแล้ว</h2>\n  <p>สวัสดีคุณ สมชาย ใจดี</p>\n  <p>กรุณาสแกน QR PromptPay และแนบสลิปภายใน 15 นาที ไม่เช่นนั้นการจองจะถูกยกเลิกอัตโนมัติ</p>\n  <p><b>เลขที่การจอง:</b> 202610070050<br><b>ยอดรวม:</b> 324 บาท</p>\n  <ul><li>คอร์ทแบด 1 — 7 ต.ค. 2569 16:00 - 17:00</li><li>คอร์ทแบด 1 — 7 ต.ค. 2569 17:00 - 18:00</li><li>ไม้แบดมินตัน × 2 — 7 ต.ค. 2569 16:00 - 18:00</li></ul>\n  <p><a href="http://localhost:5173/bookings/50">ดูรายละเอียดการจอง</a></p>\n  <p style="color:#64748b;font-size:12px">SportHub — ระบบจองสนามกีฬาและยืมอุปกรณ์</p></div>	web	\N	\N	2026-10-07 11:39:46.418396+07
13	2	50	approved	member@sporthub.local	[SportHub] ชำระเงินสำเร็จ #202610070050	<div style="font-family:sans-serif;max-width:560px">\n  <h2 style="color:#0f766e">ชำระเงินสำเร็จ</h2>\n  <p>สวัสดีคุณ สมชาย ใจดี</p>\n  <p>แสดง QR นี้ที่เคาน์เตอร์เพื่อเช็คอิน</p><img src="data:image/png;base64,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" width="200" alt="QR เช็คอิน">\n  <p><b>เลขที่การจอง:</b> 202610070050<br><b>ยอดรวม:</b> 324 บาท</p>\n  <ul><li>คอร์ทแบด 1 — 7 ต.ค. 2569 16:00 - 17:00</li><li>คอร์ทแบด 1 — 7 ต.ค. 2569 17:00 - 18:00</li><li>ไม้แบดมินตัน × 2 — 7 ต.ค. 2569 16:00 - 18:00</li></ul>\n  <p><a href="http://localhost:5173/bookings/50">ดูรายละเอียดการจอง</a></p>\n  <p style="color:#64748b;font-size:12px">SportHub — ระบบจองสนามกีฬาและยืมอุปกรณ์</p></div>	web	\N	2026-10-07 11:40:06.727707+07	2026-10-07 11:39:49.29145+07
14	4	56	cancelled	anan@sporthub.local	[SportHub] การจอง #202610070056 ถูกยกเลิก	<div style="font-family:sans-serif;max-width:560px">\n  <h2 style="color:#0f766e">การจองถูกยกเลิก</h2>\n  <p>สวัสดีคุณ อนันต์ วิ่งเร็ว</p>\n  <p>หมดเวลาชำระเงิน ระบบยกเลิกการจองให้อัตโนมัติ</p>\n  <p><b>เลขที่การจอง:</b> 202610070056<br><b>ยอดรวม:</b> 4,050 บาท</p>\n  <ul><li>สนามหญ้าเทียม A (7 คน) — 8 ต.ค. 2569 17:00 - 18:00</li><li>สนามหญ้าเทียม A (7 คน) — 15 ต.ค. 2569 17:00 - 18:00</li><li>สนามหญ้าเทียม A (7 คน) — 22 ต.ค. 2569 17:00 - 18:00</li></ul>\n  <p><a href="http://localhost:5173/bookings/56">ดูรายละเอียดการจอง</a></p>\n  <p style="color:#64748b;font-size:12px">SportHub — ระบบจองสนามกีฬาและยืมอุปกรณ์</p></div>	web	\N	\N	2026-10-26 03:41:45.27402+07
15	4	57	cancelled	anan@sporthub.local	[SportHub] การจอง #202610070057 ถูกยกเลิก	<div style="font-family:sans-serif;max-width:560px">\n  <h2 style="color:#0f766e">การจองถูกยกเลิก</h2>\n  <p>สวัสดีคุณ อนันต์ วิ่งเร็ว</p>\n  <p>หมดเวลาชำระเงิน ระบบยกเลิกการจองให้อัตโนมัติ</p>\n  <p><b>เลขที่การจอง:</b> 202610070057<br><b>ยอดรวม:</b> 4,050 บาท</p>\n  <ul><li>สนามหญ้าเทียม A (7 คน) — 8 ต.ค. 2569 18:00 - 19:00</li><li>สนามหญ้าเทียม A (7 คน) — 15 ต.ค. 2569 18:00 - 19:00</li><li>สนามหญ้าเทียม A (7 คน) — 22 ต.ค. 2569 18:00 - 19:00</li></ul>\n  <p><a href="http://localhost:5173/bookings/57">ดูรายละเอียดการจอง</a></p>\n  <p style="color:#64748b;font-size:12px">SportHub — ระบบจองสนามกีฬาและยืมอุปกรณ์</p></div>	web	\N	\N	2026-10-26 03:41:45.2877+07
16	6	52	cancelled	krit@sporthub.local	[SportHub] การจอง #202610070052 ถูกยกเลิก	<div style="font-family:sans-serif;max-width:560px">\n  <h2 style="color:#0f766e">การจองถูกยกเลิก</h2>\n  <p>สวัสดีคุณ กฤษดา ชู้ตไกล</p>\n  <p>หมดเวลาชำระเงิน ระบบยกเลิกการจองให้อัตโนมัติ</p>\n  <p><b>เลขที่การจอง:</b> 202610070052<br><b>ยอดรวม:</b> 1,200 บาท</p>\n  <ul><li>สนามหญ้าเทียม A (7 คน) — 8 ต.ค. 2569 09:00 - 10:00</li></ul>\n  <p><a href="http://localhost:5173/bookings/52">ดูรายละเอียดการจอง</a></p>\n  <p style="color:#64748b;font-size:12px">SportHub — ระบบจองสนามกีฬาและยืมอุปกรณ์</p></div>	web	\N	\N	2026-10-26 03:41:45.296022+07
17	6	58	cancelled	krit@sporthub.local	[SportHub] การจอง #202610070058 ถูกยกเลิก	<div style="font-family:sans-serif;max-width:560px">\n  <h2 style="color:#0f766e">การจองถูกยกเลิก</h2>\n  <p>สวัสดีคุณ กฤษดา ชู้ตไกล</p>\n  <p>หมดเวลาชำระเงิน ระบบยกเลิกการจองให้อัตโนมัติ</p>\n  <p><b>เลขที่การจอง:</b> 202610070058<br><b>ยอดรวม:</b> 1,200 บาท</p>\n  <ul><li>สนามหญ้าเทียม A (7 คน) — 8 ต.ค. 2569 10:00 - 11:00</li></ul>\n  <p><a href="http://localhost:5173/bookings/58">ดูรายละเอียดการจอง</a></p>\n  <p style="color:#64748b;font-size:12px">SportHub — ระบบจองสนามกีฬาและยืมอุปกรณ์</p></div>	web	\N	\N	2026-10-26 03:41:45.303931+07
18	2	63	confirmed	member@sporthub.local	[SportHub] ยืนยันการจอง #202610070063 — กรุณาชำระเงินภายใน 15 นาที	<div style="font-family:sans-serif;max-width:560px">\n  <h2 style="color:#0f766e">ได้รับการจองแล้ว</h2>\n  <p>สวัสดีคุณ สมชาย ใจดี</p>\n  <p>กรุณาสแกน QR PromptPay และแนบสลิปภายใน 15 นาที ไม่เช่นนั้นการจองจะถูกยกเลิกอัตโนมัติ</p>\n  <p><b>เลขที่การจอง:</b> 202610070063<br><b>ยอดรวม:</b> 324 บาท</p>\n  <ul><li>คอร์ทแบด 1 — 26 ต.ค. 2569 08:00 - 09:00</li><li>คอร์ทแบด 1 — 26 ต.ค. 2569 09:00 - 10:00</li><li>ไม้แบดมินตัน × 2 — 26 ต.ค. 2569 08:00 - 10:00</li></ul>\n  <p><a href="http://localhost:5173/bookings/63">ดูรายละเอียดการจอง</a></p>\n  <p style="color:#64748b;font-size:12px">SportHub — ระบบจองสนามกีฬาและยืมอุปกรณ์</p></div>	web	\N	\N	2026-10-26 04:14:30.726687+07
19	2	63	approved	member@sporthub.local	[SportHub] ชำระเงินสำเร็จ #202610070063	<div style="font-family:sans-serif;max-width:560px">\n  <h2 style="color:#0f766e">ชำระเงินสำเร็จ</h2>\n  <p>สวัสดีคุณ สมชาย ใจดี</p>\n  <p>แสดง QR นี้ที่เคาน์เตอร์เพื่อเช็คอิน</p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAAAklEQVR4AewaftIAAAbaSURBVO3BgY0jRxAEwawG/Xe5JAtmD5hf8fSdEem/kLTSIGmtQdJag6S1BklrDZLWGiStNUhaa5C01ocfSMIGbTlJwo22vC0JJ215koSTttxIwtvacpKEDdpyMkhaa5C01iBprUHSWoOktQZJaw2S1vrwB7Tlt0vC29pyKwnf1paTJLytLd/Wlt8uCTcGSWsNktYaJK01SFprkLTWIGmtQdJaH/4DSXhbW97WlpMknLTlbW25lYQbbTlJwpMknLTl25Lwtra8aZC01iBprUHSWoOktQZJaw2S1hokrTVIWuuDfiwJN5Jwqy03kvCkLTeS8LYknLRFzwZJaw2S1hokrTVIWmuQtNYgaa1B0lof9GNtOUnCrbZ8WxJutOVWEvS+QdJag6S1BklrDZLWGiStNUhaa5C01of/QFs2aMvbknCjLd+WhFtt+ba2/N8NktYaJK01SFprkLTWIGmtQdJag6S1PvwBSdggCSdtOUnCk7bcaMtJEp605SQJJ2251ZaTJJy05VYS/naDpLUGSWsNktYaJK01SFprkLTWIGmtQdJaH36gLbrXllttudGWtyXht2uLYJC01iBprUHSWoOktQZJaw2S1hokrfXhB5Jw0paTJNxqy0kS3taWG0l40pYbSThpy5MkvKkt35aEJ225kYSTtjxJwo22nAyS1hokrTVIWmuQtNYgaa1B0lqDpLU+/EBbTpJwqy1vasuTJPztknCrLW9LwklbTpJwKwk32vLbDZLWGiStNUhaa5C01iBprUHSWoOktT78QBJO2nKShFtJOGnLSRKetOUkCSdt+e3a8rYk3GrLSRJutOVJEk7acpKEt7XlxiBprUHSWoOktQZJaw2S1hokrTVIWmuQtNaHv0QSTtryJAlvasvb2vK2JJy05SQJT5Jw0pb/u7bcSsJJW04GSWsNktYaJK01SFprkLTWIGmtQdJa6b+4lISTtjxJwklbbiThSVtuJOFWW96UBEFb3paEW2150yBprUHSWoOktQZJaw2S1hokrTVIWuvDDyThRhKetOUkCTfacisJJ225lYQbbbnVlhtJ+La2nCThSVtutOVWEm605WSQtNYgaa1B0lqDpLUGSWsNktYaJK314Q9oy0kSvi0Jf4O2nCThpC23knCjLU+ScCMJJ225lYSTttxqy0kSbgyS1hokrTVIWmuQtNYgaa1B0lqDpLUGSWul/+JlSXjSlhtJOGnLkySctOUkCSdt+bYkvK0tb0vCSVtuJeFGW24l4aQtNwZJaw2S1hokrTVIWmuQtNYgaa1B0lrpv3iQhJO23ErCt7Xlt0vCSVtOkvCkLW9KwtvacisJb2rLrSSctOVkkLTWIGmtQdJag6S1BklrDZLWGiSt9eEH2vLbteVWEk7a8rYkfFsSTtpyoy1vS8JJW2615SQJt5Jw0pYbg6S1BklrDZLWGiStNUhaa5C01iBprQ8/kISTtrytLTeScCsJN9pyqy0nSXhbEk7a8rYknLTl29pykoRvGyStNUhaa5C01iBprUHSWoOktQZJaw2S1vrwA225kYS3JeGkLU+ScKMtt9ry27XlJAm32vJ/l4RbbTlJwklbTgZJaw2S1hokrTVIWmuQtNYgaa1B0lof/oAknLTlSRLelIQnbbmRhFttOUnC29pykoQbbXmShBtJeFsS3paENw2S1hokrTVIWmuQtNYgaa1B0lqDpLU+/AFtudWWG215WxJO2nKShFtt2aAtJ0k4acvbknDSlltJeNMgaa1B0lqDpLUGSWsNktYaJK01SFrrww8kYYO2vKkt35aEJ235tiS8KQlP2vLbteXGIGmtQdJag6S1BklrDZLWGiStNUhaa5C01oc/oC2/XRI2SMK3teUkCU/acpKEG235GyThpC0ng6S1BklrDZLWGiStNUhaa5C01iBprQ//gSS8rS1va8vbknDSlpO23ErCjSR8WxJ+uyTcasuNQdJag6S1BklrDZLWGiStNUhaa5C01gf9WBJutOVWEm605VZbTpJwKwk32vK2JJwk4VZbTpJw0paTQdJag6S1BklrDZLWGiStNUhaa5C01gf9MW251ZaTJNxIwpO2nCThRlueJOGkLSdJOGnLrbacJOG3GyStNUhaa5C01iBprUHSWoOktQZJaw2S1vrwH2jL36Atb0vCm9ryJAknbbmRhCdtOUnCSVtuJeFGW24l4aQtNwZJaw2S1hokrTVIWmuQtNYgaa1B0lof/oAkbJCEG2251Za3teUkCSdtOWnLkyTcSMKttpwk4f9ukLTWIGmtQdJag6S1BklrDZLWGiStlf4LSSsNktYaJK01SFprkLTWIGmtQdJag6S1/gEuakcW5oTcUQAAAABJRU5ErkJggg==" width="200" alt="QR เช็คอิน">\n  <p><b>เลขที่การจอง:</b> 202610070063<br><b>ยอดรวม:</b> 324 บาท</p>\n  <ul><li>คอร์ทแบด 1 — 26 ต.ค. 2569 08:00 - 09:00</li><li>คอร์ทแบด 1 — 26 ต.ค. 2569 09:00 - 10:00</li><li>ไม้แบดมินตัน × 2 — 26 ต.ค. 2569 08:00 - 10:00</li></ul>\n  <p><a href="http://localhost:5173/bookings/63">ดูรายละเอียดการจอง</a></p>\n  <p style="color:#64748b;font-size:12px">SportHub — ระบบจองสนามกีฬาและยืมอุปกรณ์</p></div>	web	\N	2026-10-26 04:14:52.074857+07	2026-10-26 04:14:33.775018+07
20	2	64	confirmed	member@sporthub.local	[SportHub] ยืนยันการจอง #202610260064 — กรุณาชำระเงินภายใน 15 นาที	<div style="font-family:sans-serif;max-width:560px">\n  <h2 style="color:#0f766e">ได้รับการจองแล้ว</h2>\n  <p>สวัสดีคุณ สมชาย ใจดี</p>\n  <p>กรุณาสแกน QR PromptPay และแนบสลิปภายใน 15 นาที ไม่เช่นนั้นการจองจะถูกยกเลิกอัตโนมัติ</p>\n  <p><b>เลขที่การจอง:</b> 202610260064<br><b>ยอดรวม:</b> 324 บาท</p>\n  <ul><li>คอร์ทแบด 1 — 26 ต.ค. 2569 10:00 - 11:00</li><li>คอร์ทแบด 1 — 26 ต.ค. 2569 11:00 - 12:00</li><li>ไม้แบดมินตัน × 2 — 26 ต.ค. 2569 10:00 - 12:00</li></ul>\n  <p><a href="http://localhost:5173/bookings/64">ดูรายละเอียดการจอง</a></p>\n  <p style="color:#64748b;font-size:12px">SportHub — ระบบจองสนามกีฬาและยืมอุปกรณ์</p></div>	web	\N	\N	2026-10-26 04:25:30.293903+07
21	2	64	approved	member@sporthub.local	[SportHub] ชำระเงินสำเร็จ #202610260064	<div style="font-family:sans-serif;max-width:560px">\n  <h2 style="color:#0f766e">ชำระเงินสำเร็จ</h2>\n  <p>สวัสดีคุณ สมชาย ใจดี</p>\n  <p>แสดง QR นี้ที่เคาน์เตอร์เพื่อเช็คอิน</p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAAAklEQVR4AewaftIAAAbKSURBVO3BgY0bSRAEwawG/Xe5XhbMChitqPvOiPQXJK00SFprkLTWIGmtQdJag6S1BklrDZLWGiSt9eE3JGGDttxIwq223EjCSVueJOGkLW9LwklbbiRhg7acDJLWGiStNUhaa5C01iBprUHSWoOktT78AW351yXhbW25lYQ3JeFtSThpy5O2fFtb/nVJuDFIWmuQtNYgaa1B0lqDpLUGSWsNktb68Bck4W1teVsSTtpykoQnbTlJwo22PEnCSRJO2nKShFtt+bYkvK0tbxokrTVIWmuQtNYgaa1B0lqDpLUGSWsNktb6oD8mCSdteZKEk7bcSMLbknCrLXrfIGmtQdJag6S1BklrDZLWGiStNUha64P+mLacJOFJW06ScNKWk7a8LQm3knCjLXo2SFprkLTWIGmtQdJag6S1BklrDZLW+vAXtGWDJNxKwrcl4UZbNmjLTzdIWmuQtNYgaa1B0lqDpLUGSWsNktb68AckQdCWkyQ8actJEm4k4UlbTpJwIwlP2nKShJO23ErC/90gaa1B0lqDpLUGSWsNktYaJK01SFprkLRW+gv6LUn4trbcSMKTtnxbEm60Rc8GSWsNktYaJK01SFprkLTWIGmtQdJaH35DEk7acpKEn6AtJ225kYQnbTlJwklbTtryJAknbTlJwq22nCThRhJ+gra8aZC01iBprUHSWoOktQZJaw2S1hokrfXhD0jCt7XlbUl4WxJO2nKShFttOUnCSVtuJeGkLW9ry0kSTtrytiSctOVkkLTWIGmtQdJag6S1BklrDZLWGiStlf7CgySctOUkCU/acpKEt7XlRhL0rC1vS8JJW54k4UZbbiXhpC03BklrDZLWGiStNUhaa5C01iBprUHSWoOktdJf+AGScKMtT5LwprY8ScJJW06ScNKWJ0k4acuNJNxqy7cl4UZbniThpC03BklrDZLWGiStNUhaa5C01iBprUHSWh9+QxJO2vKvS8Lb2vJtbTlJwq0k3GjL25Jw0pZbbbmRhCdtedMgaa1B0lqDpLUGSWsNktYaJK01SFrrw29oy40k3GrLtyXhp2vLtyXh25LwbW15koQbbTkZJK01SFprkLTWIGmtQdJag6S1BklrffgNSfjpknCrLSdJeFsSTtpyKwknbTlJwq22nCThpC0nSfgJ2vKmQdJag6S1BklrDZLWGiStNUhaa5C01iBprQ9/QFtuJeFGEk7acisJJ225lYQ3JeFtbTlJwre1RTBIWmuQtNYgaa1B0lqDpLUGSWsNktb68BvacpKEk7Z8WxKetOXb2vKmttxKwo22PEnCSVtOknDSlidJOGnLSRLe1pYbg6S1BklrDZLWGiStNUhaa5C01iBprQ+/IQk3kvBtbfk/SMLb2nLSlhtJeFtbTpLwpC0nSThpy9uScNKWk0HSWoOktQZJaw2S1hokrTVIWmuQtFb6Cw+ScNKWkyTcasuNJNxqy40kPGnLjSS8rS2CJNxoy5MknLTlxiBprUHSWoOktQZJaw2S1hokrTVIWmuQtNaHv6AtT5JwIwknbXmShJMknLTlpC3f1pZvS8K3teVJEv7vBklrDZLWGiStNUhaa5C01iBprUHSWukvPEjCSVveloSTtpwk4UlbTpLwbW25kYRbbTlJwq22nCThX9eWkyQ8acubBklrDZLWGiStNUhaa5C01iBprUHSWukv6Lck4aQtGyThpC1vS8JJW96WhJO2vC0JJ205GSStNUhaa5C01iBprUHSWoOktQZJa334DUnYoC0nbXlbEk7a8rYkvCkJ35aEJ215UxJuteXGIGmtQdJag6S1BklrDZLWGiStNUhaa5C01oc/oC3/uiTcSsKNtjxpy0kSTtpykoQnbXlTW54k4U1teVsSTtryJAlvGiStNUhaa5C01iBprUHSWoOktQZJa334C5LwtrZs0JYbbXmShG9ry0kSTpLwbW05ScKTtrxpkLTWIGmtQdJag6S1BklrDZLWGiSt9UF/TFtOkvATtOWna8utJJy05UZbniThRltOBklrDZLWGiStNUhaa5C01iBprUHSWh/017TlSRJO2nIjCU+ScNKWb2vLSRJuteUkCTfacqstNwZJaw2S1hokrTVIWmuQtNYgaa1B0lqDpLU+/AVt+T9oy0/XlltJOGnL25Jw0pZbSbjRln/dIGmtQdJag6S1BklrDZLWGiStNUha68MfkIQNknCjLW9LwklbniThpC0nSThpy5MknLTlJAlva8uNJDxpy5sGSWsNktYaJK01SFprkLTWIGmtQdJa6S9IWmmQtNYgaa1B0lqDpLUGSWsNktYaJK31Hy6HPhP+G3WIAAAAAElFTkSuQmCC" width="200" alt="QR เช็คอิน">\n  <p><b>เลขที่การจอง:</b> 202610260064<br><b>ยอดรวม:</b> 324 บาท</p>\n  <ul><li>คอร์ทแบด 1 — 26 ต.ค. 2569 10:00 - 11:00</li><li>คอร์ทแบด 1 — 26 ต.ค. 2569 11:00 - 12:00</li><li>ไม้แบดมินตัน × 2 — 26 ต.ค. 2569 10:00 - 12:00</li></ul>\n  <p><a href="http://localhost:5173/bookings/64">ดูรายละเอียดการจอง</a></p>\n  <p style="color:#64748b;font-size:12px">SportHub — ระบบจองสนามกีฬาและยืมอุปกรณ์</p></div>	web	\N	2026-10-26 04:25:51.403339+07	2026-10-26 04:25:33.327897+07
22	2	47	approved	member@sporthub.local	[SportHub] ชำระเงินสำเร็จ #202610070047	<div style="font-family:sans-serif;max-width:560px">\n  <h2 style="color:#0f766e">ชำระเงินสำเร็จ</h2>\n  <p>สวัสดีคุณ สมชาย ใจดี</p>\n  <p>แสดง QR นี้ที่เคาน์เตอร์เพื่อเช็คอิน</p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAAAklEQVR4AewaftIAAAbTSURBVO3BgW0cSRAEwazG+e9yvSyYFTBckfzOiPQPJK00SFprkLTWIGmtQdJag6S1BklrDZLWGiSt9eEvJGGDtrwpCbfacpKEk7Y8ScJJW96WhJO23EjCBm05GSStNUhaa5C01iBprUHSWoOktQZJa334Am356ZLwG7TlTUm4lYQbbXnSlpMknLTlVlt+uiTcGCStNUhaa5C01iBprUHSWoOktQZJa334B5Lwtra8LQknbbmVhDe15bsl4UlbTtry3ZLwtra8aZC01iBprUHSWoOktQZJaw2S1hokrTVIWuuDvkwSbrXlTUn4P0jCSVv0bJC01iBprUHSWoOktQZJaw2S1hokrfVBX6Ytb0vCSVtO2vK2JNxKwklbdG+QtNYgaa1B0lqDpLUGSWsNktYaJK314R9oi75GW96WhJO2nLTlbUk4acvb2vLbDZLWGiStNUhaa5C01iBprUHSWoOktT58gSToWRKetOUkCSdtOUnCk7acJOGkLSdJeNKW75aE/7tB0lqDpLUGSWsNktYaJK01SFprkLTWIGmtD3+hLbrXlltt+e3acqstN9oiGCStNUhaa5C01iBprUHSWoOktQZJa6V/8CAJJ205ScJv0JYbSbjVlpMknLTlVhK+W1velITfoC1vGiStNUhaa5C01iBprUHSWoOktQZJa334C215W1tOknDSlrcl4aQtJ0m41ZaTJNxqy3dLwm/XlltJuNGWk0HSWoOktQZJaw2S1hokrTVIWmuQtNaHv5CEG235bkl40pYbSfg/SMJJW97WlhtJOGnLrSScJOGkLU/a8qZB0lqDpLUGSWsNktYaJK01SFprkLTWIGmtD1+gLbeS8Ka2PEnCjbacJOG7teVJEk6ScNKWkyTcastJW75bW366QdJag6S1BklrDZLWGiStNUhaa5C01oe/0JYbSbjVlpMk3GrLjSS8LQknbTlJwq22nCThpC1vS8JJW54k4aQtJ0l4W1tuDJLWGiStNUhaa5C01iBprUHSWoOktdI/uJSEk7a8LQknbXmShDe15f8gCSdtOUnCb9CWkySctOUkCU/acpKEk7acDJLWGiStNUhaa5C01iBprUHSWoOktdI/uJSEDdpykoRbbfluSbjRlrcl4aQtJ0l40pYbSThpy5MknLTlxiBprUHSWoOktQZJaw2S1hokrTVIWmuQtNaHv5CE364tT5JwkoQbbXmShBttOUnCrbb8dm15koQbbfnpBklrDZLWGiStNUhaa5C01iBprUHSWh++QFtOknCrLSdJOEnC29ry07XlSRJOknCjLU+ScNKWkySctOVWW06S8NMNktYaJK01SFprkLTWIGmtQdJag6S1PvwDbXmShJMk3GjL25Lw3ZJwqy1vSsLb2nKShCdtOUnCSVtOkvCkLSdJOGnLySBprUHSWoOktQZJaw2S1hokrTVIWiv9gwdJOGnLSRKetOUkCd+tLTeS8KQtN5LwtracJOGkLbeScNKWW0k4acvbknDSlhuDpLUGSWsNktYaJK01SFprkLTWIGmtQdJa6R88SMJJW96WhBtteZKEG225lYSTtpwk4aQtt5Jw0paTJDxpy40knLTlVhJO2vK2JJy05WSQtNYgaa1B0lqDpLUGSWsNktYaJK2V/sGDJJy05VYSbrTlJAlP2nIjCSdt+W5JuNWWkyTo32jLjUHSWoOktQZJaw2S1hokrTVIWmuQtFb6B/orSXhbW366JJy05VYSbrTlbUk4acutJNxoy8kgaa1B0lqDpLUGSWsNktYaJK01SFrrw19IwgZtOWnLjSQ8ScKNttxKwv9dEp605U1JeNKWNw2S1hokrTVIWmuQtNYgaa1B0lqDpLUGSWt9+AJt+emScCsJv10SvlsSnrTlJAk32vLd2vIkCSdtuTFIWmuQtNYgaa1B0lqDpLUGSWsNktb68A8k4W1t+W5teVsSbrTlSRJuJOG7JeG7JeFWW940SFprkLTWIGmtQdJag6S1BklrDZLW+qBfpS03kvCkLTeScNKW79aWJ0k4acvbknCjLSeDpLUGSWsNktYaJK01SFprkLTWIGmtD/pnkvAbJOGkLSdtOUnCk7actOVGEp605SQJN9pyqy03BklrDZLWGiStNUhaa5C01iBprUHSWoOktT78A235P2jLjbY8ScJ3a8ub2vIkCW9qy5Mk3GjLTzdIWmuQtNYgaa1B0lqDpLUGSWsNktb68AWSsEESTtrytrbcSMKTJJy05SQJJ2150pafri03kvCkLW8aJK01SFprkLTWIGmtQdJag6S1BklrpX8gaaVB0lqDpLUGSWsNktYaJK01SFprkLTWf8qQVug1nqhlAAAAAElFTkSuQmCC" width="200" alt="QR เช็คอิน">\n  <p><b>เลขที่การจอง:</b> 202610070047<br><b>ยอดรวม:</b> 620 บาท</p>\n  <ul><li>สนามบาสในร่ม — 9 ต.ค. 2569 11:00 - 12:00</li><li>ลูกขนไก่ (หลอด 12 ลูก) × 1 — 9 ต.ค. 2569 11:00 - 12:00</li></ul>\n  <p><a href="http://localhost:5173/bookings/47">ดูรายละเอียดการจอง</a></p>\n  <p style="color:#64748b;font-size:12px">SportHub — ระบบจองสนามกีฬาและยืมอุปกรณ์</p></div>	web	\N	\N	2026-10-26 16:11:29.107173+07
23	1	51	confirmed	admin@sporthub.local	[SportHub] ยืนยันการจอง #202610070051 — กรุณาชำระเงินภายใน 15 นาที	<div style="font-family:sans-serif;max-width:560px">\n  <h2 style="color:#0f766e">ได้รับการจองแล้ว</h2>\n  <p>สวัสดีคุณ ผู้ดูแลระบบ</p>\n  <p>กรุณาสแกน QR PromptPay และแนบสลิปภายใน 15 นาที ไม่เช่นนั้นการจองจะถูกยกเลิกอัตโนมัติ</p>\n  <p><b>เลขที่การจอง:</b> 202610070051<br><b>ยอดรวม:</b> 1,500 บาท</p>\n  <ul><li>สนามหญ้าเทียม A (7 คน) — 27 ต.ค. 2569 23:00 - 00:00</li></ul>\n  <p><a href="http://localhost:5173/bookings/51">ดูรายละเอียดการจอง</a></p>\n  <p style="color:#64748b;font-size:12px">SportHub — ระบบจองสนามกีฬาและยืมอุปกรณ์</p></div>	web	\N	2026-10-27 22:29:34.112829+07	2026-10-27 22:27:49.817279+07
24	1	51	cancelled	admin@sporthub.local	[SportHub] การจอง #202610070051 ถูกยกเลิก	<div style="font-family:sans-serif;max-width:560px">\n  <h2 style="color:#0f766e">การจองถูกยกเลิก</h2>\n  <p>สวัสดีคุณ ผู้ดูแลระบบ</p>\n  <p>ยกเลิกตามคำขอของคุณ</p>\n  <p><b>เลขที่การจอง:</b> 202610070051<br><b>ยอดรวม:</b> 1,500 บาท</p>\n  <ul><li>สนามหญ้าเทียม A (7 คน) — 27 ต.ค. 2569 23:00 - 00:00</li></ul>\n  <p><a href="http://localhost:5173/bookings/51">ดูรายละเอียดการจอง</a></p>\n  <p style="color:#64748b;font-size:12px">SportHub — ระบบจองสนามกีฬาและยืมอุปกรณ์</p></div>	web	\N	2026-10-27 22:45:34.565573+07	2026-10-27 22:36:25.162691+07
\.


--
-- Data for Name: equipment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.equipment (id, sport_id, name, description, total_qty, rent_price, deposit, image_url, is_active, created_at) FROM stdin;
1	1	ลูกฟุตบอล เบอร์ 5	ลูกหนังเย็บมือ ใช้แข่งขันได้	10	30.00	300.00	/photos/equipment/01.jpg	t	2026-10-07 11:17:35.078638+07
2	1	เสื้อเอี๊ยม (ชุด 7 ตัว)	แบ่งทีมสีส้ม/เขียว	6	50.00	200.00	/photos/equipment/02.jpg	t	2026-10-07 11:17:35.078638+07
3	2	ไม้แบดมินตัน	ไม้คาร์บอน น้ำหนัก 4U	20	30.00	300.00	/photos/equipment/03.jpg	t	2026-10-07 11:17:35.078638+07
4	2	ลูกขนไก่ (หลอด 12 ลูก)	ลูกขนเป็ดเกรดซ้อม	15	120.00	0.00	/photos/equipment/04.jpg	t	2026-10-07 11:17:35.078638+07
5	3	ลูกบาสเกตบอล เบอร์ 7	ลูกยางหนังเทียม เกาะมือ	8	30.00	300.00	/photos/equipment/05.jpg	t	2026-10-07 11:17:35.078638+07
6	4	ไม้เทนนิส	ไม้กราไฟต์ ขนาดหน้าไม้ 100	10	80.00	1000.00	/photos/equipment/06.jpg	t	2026-10-07 11:17:35.078638+07
7	4	ลูกเทนนิส (กระป๋อง 3 ลูก)	ลูกมาตรฐาน ITF	12	60.00	0.00	/photos/equipment/07.jpg	t	2026-10-07 11:17:35.078638+07
8	5	ไม้ปิงปอง (คู่)	ไม้พร้อมยางสองหน้า	12	20.00	200.00	/photos/equipment/08.jpg	t	2026-10-07 11:17:35.078638+07
9	5	ลูกปิงปอง (แพ็ค 6)	ลูก 3 ดาว 40+	20	20.00	0.00	/photos/equipment/09.jpg	t	2026-10-07 11:17:35.078638+07
10	6	ลูกวอลเลย์บอล	ลูกหนังเทียม น้ำหนักมาตรฐาน	8	30.00	300.00	/photos/equipment/10.jpg	t	2026-10-07 11:17:35.078638+07
13	13	ลูกฟุตซอล เบอร์ 4	ลูกเด้งต่ำสำหรับพื้นในร่ม	10	30.00	300.00	/photos/equipment/11.jpg	t	2026-10-26 16:14:46.700052+07
14	14	แว่นตาว่ายน้ำ	ปรับสายได้ ทำความสะอาดทุกครั้ง	20	20.00	100.00	/photos/equipment/12.jpg	t	2026-10-26 16:14:46.700052+07
15	14	โฟมเตะขา	สำหรับฝึกว่าย	15	10.00	0.00	/photos/equipment/13.jpg	t	2026-10-26 16:14:46.700052+07
16	15	นวมชกมวย (คู่)	นวม 12 ออนซ์	12	40.00	300.00	/photos/equipment/14.jpg	t	2026-10-26 16:14:46.700052+07
17	15	เป้าล่อ (คู่)	เป้ามือสำหรับเทรนเนอร์	6	30.00	200.00	/photos/equipment/15.jpg	t	2026-10-26 16:14:46.700052+07
18	16	ไม้คิว	ไม้คิวหัว 9.5 มม.	10	30.00	500.00	/photos/equipment/16.jpg	t	2026-10-26 16:14:46.700052+07
19	17	รองเท้าโบว์ลิ่ง (คู่)	มีทุกไซซ์ 36-46	30	30.00	0.00	/photos/equipment/17.jpg	t	2026-10-26 16:14:46.700052+07
20	18	ชุดไม้กอล์ฟ	ไดรเวอร์ เหล็ก 7 และพัตเตอร์	8	150.00	2000.00	/photos/equipment/18.jpg	t	2026-10-26 16:14:46.700052+07
21	18	ลูกกอล์ฟ (ตะกร้า 50 ลูก)	ลูกซ้อมระยะเพิ่ม	30	60.00	0.00	/photos/equipment/19.jpg	t	2026-10-26 16:14:46.700052+07
22	19	ชุดธนู Recurve	คันธนูพร้อมลูกธนู 6 ดอก	8	100.00	1000.00	/photos/equipment/20.jpg	t	2026-10-26 16:14:46.700052+07
23	20	ชุดปีนผา	ฮาร์เนส รองเท้าปีน และถุงชอล์ก	12	80.00	500.00	/photos/equipment/21.jpg	t	2026-10-26 16:14:46.700052+07
24	21	ไม้ฮอกกี้	ไม้คอมโพสิต 36.5 นิ้ว	22	30.00	300.00	/photos/equipment/22.jpg	t	2026-10-26 16:14:46.700052+07
25	22	ไม้เบสบอลและหมวกกันน็อก	ไม้อะลูมิเนียม 32 นิ้ว	8	40.00	500.00	/photos/equipment/23.jpg	t	2026-10-26 16:14:46.700052+07
26	23	ลูกรักบี้ เบอร์ 5	ลูกมาตรฐานสำหรับแข่ง	8	30.00	300.00	/photos/equipment/24.jpg	t	2026-10-26 16:14:46.700052+07
27	24	ชุดฟันดาบ	หน้ากาก เสื้อเกราะ และดาบฟอยล์	6	150.00	1500.00	/photos/equipment/25.jpg	t	2026-10-26 16:14:46.700052+07
28	25	ผ้าเย็นและล็อกเกอร์	ผ้าเย็นพร้อมกุญแจล็อกเกอร์	40	20.00	0.00	/photos/equipment/26.jpg	t	2026-10-26 16:14:46.700052+07
\.


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.migrations (name, run_at) FROM stdin;
001_init.sql	2026-10-07 11:17:34.762708+07
002_peak_pricing.sql	2026-10-07 11:17:34.794976+07
003_coupons.sql	2026-10-07 11:17:34.798892+07
004_mail_and_settings.sql	2026-10-07 11:17:34.804368+07
005_coupon_campaigns.sql	2026-10-27 22:40:39.105477+07
006_catalog_photos.sql	2026-10-28 22:15:36.740739+07
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payments (id, booking_id, amount, slip_path, status, note, reviewed_by, reviewed_at, created_at) FROM stdin;
1	1	820.00	seed-slip.png	approved	\N	1	2026-09-22 14:10:00+07	2026-09-22 14:05:00+07
2	2	400.00	seed-slip.png	approved	\N	1	2026-09-22 06:10:00+07	2026-09-22 06:05:00+07
3	3	250.00	seed-slip.png	approved	\N	1	2026-09-22 22:10:00+07	2026-09-22 22:05:00+07
4	4	80.00	seed-slip.png	approved	\N	1	2026-09-21 16:10:00+07	2026-09-21 16:05:00+07
5	5	400.00	seed-slip.png	approved	\N	1	2026-09-22 20:10:00+07	2026-09-22 20:05:00+07
6	6	600.00	seed-slip.png	approved	\N	1	2026-09-22 22:10:00+07	2026-09-22 22:05:00+07
7	7	150.00	seed-slip.png	approved	\N	1	2026-09-23 02:10:00+07	2026-09-23 02:05:00+07
8	8	120.00	seed-slip.png	approved	\N	1	2026-09-24 11:10:00+07	2026-09-24 11:05:00+07
9	9	270.00	seed-slip.png	approved	\N	1	2026-09-25 03:10:00+07	2026-09-25 03:05:00+07
10	10	180.00	seed-slip.png	approved	\N	1	2026-09-24 20:10:00+07	2026-09-24 20:05:00+07
11	11	250.00	seed-slip.png	approved	\N	1	2026-09-24 14:10:00+07	2026-09-24 14:05:00+07
12	12	160.00	seed-slip.png	approved	\N	1	2026-09-25 11:10:00+07	2026-09-25 11:05:00+07
13	13	150.00	seed-slip.png	approved	\N	1	2026-09-25 02:10:00+07	2026-09-25 02:05:00+07
14	14	150.00	seed-slip.png	approved	\N	1	2026-09-25 03:10:00+07	2026-09-25 03:05:00+07
15	15	120.00	seed-slip.png	approved	\N	1	2026-09-27 05:10:00+07	2026-09-27 05:05:00+07
16	16	140.00	seed-slip.png	approved	\N	1	2026-09-26 14:10:00+07	2026-09-26 14:05:00+07
17	17	1260.00	seed-slip.png	approved	\N	1	2026-09-26 09:10:00+07	2026-09-26 09:05:00+07
18	18	490.00	seed-slip.png	approved	\N	1	2026-09-27 12:10:00+07	2026-09-27 12:05:00+07
19	19	840.00	seed-slip.png	approved	\N	1	2026-09-28 12:10:00+07	2026-09-28 12:05:00+07
20	20	800.00	seed-slip.png	approved	\N	1	2026-09-29 05:10:00+07	2026-09-29 05:05:00+07
21	21	110.00	seed-slip.png	approved	\N	1	2026-09-29 07:10:00+07	2026-09-29 07:05:00+07
22	22	310.00	seed-slip.png	approved	\N	1	2026-09-28 08:10:00+07	2026-09-28 08:05:00+07
23	23	800.00	seed-slip.png	approved	\N	1	2026-09-30 18:10:00+07	2026-09-30 18:05:00+07
24	24	1260.00	seed-slip.png	approved	\N	1	2026-09-30 01:10:00+07	2026-09-30 01:05:00+07
25	25	250.00	seed-slip.png	approved	\N	1	2026-09-29 15:10:00+07	2026-09-29 15:05:00+07
26	26	1230.00	seed-slip.png	approved	\N	1	2026-09-30 02:10:00+07	2026-09-30 02:05:00+07
27	27	140.00	seed-slip.png	approved	\N	1	2026-10-01 04:10:00+07	2026-10-01 04:05:00+07
28	28	410.00	seed-slip.png	approved	\N	1	2026-10-01 02:10:00+07	2026-10-01 02:05:00+07
29	29	620.00	seed-slip.png	approved	\N	1	2026-10-02 02:10:00+07	2026-10-02 02:05:00+07
30	30	290.00	seed-slip.png	approved	\N	1	2026-10-01 09:10:00+07	2026-10-01 09:05:00+07
31	31	190.00	seed-slip.png	approved	\N	1	2026-10-01 20:10:00+07	2026-10-01 20:05:00+07
32	32	80.00	seed-slip.png	approved	\N	1	2026-10-02 15:10:00+07	2026-10-02 15:05:00+07
33	33	250.00	seed-slip.png	approved	\N	1	2026-10-02 04:10:00+07	2026-10-02 04:05:00+07
34	34	860.00	seed-slip.png	approved	\N	1	2026-10-03 14:10:00+07	2026-10-03 14:05:00+07
35	35	210.00	seed-slip.png	approved	\N	1	2026-10-04 03:10:00+07	2026-10-04 03:05:00+07
36	36	230.00	seed-slip.png	approved	\N	1	2026-10-03 23:10:00+07	2026-10-03 23:05:00+07
37	37	400.00	seed-slip.png	approved	\N	1	2026-10-05 13:10:00+07	2026-10-05 13:05:00+07
38	38	660.00	seed-slip.png	approved	\N	1	2026-10-03 22:10:00+07	2026-10-03 22:05:00+07
39	39	140.00	seed-slip.png	approved	\N	1	2026-10-06 07:10:00+07	2026-10-06 07:05:00+07
40	40	150.00	seed-slip.png	approved	\N	1	2026-10-05 06:10:00+07	2026-10-05 06:05:00+07
41	41	560.00	seed-slip.png	approved	\N	1	2026-10-05 11:10:00+07	2026-10-05 11:05:00+07
42	42	600.00	seed-slip.png	approved	\N	1	2026-10-06 01:10:00+07	2026-10-06 01:05:00+07
43	43	180.00	seed-slip.png	approved	\N	1	2026-10-07 10:57:35.25+07	2026-10-07 10:52:35.25+07
44	44	800.00	seed-slip.png	approved	\N	1	2026-10-07 10:10:00+07	2026-10-07 10:05:00+07
45	45	500.00	seed-slip.png	approved	\N	1	2026-10-07 10:57:35.255+07	2026-10-07 10:52:35.255+07
46	46	620.00	seed-slip.png	approved	\N	1	2026-10-07 10:57:35.258+07	2026-10-07 10:52:35.258+07
48	49	324.00	f38f5aad-6512-41cd-8e2a-69e6da5c2220.png	approved	\N	1	2026-10-07 11:17:46.310604+07	2026-10-07 11:17:44.325047+07
49	53	210.00	11df87d7-02a5-404d-8177-e70e6bffa632.png	approved	\N	1	2026-10-07 11:37:24.828476+07	2026-10-07 11:37:24.224686+07
50	59	210.00	5c096673-7f78-4725-b5e3-54e70048cc82.png	approved	\N	1	2026-10-07 11:37:43.644384+07	2026-10-07 11:37:43.032988+07
51	50	324.00	0e874fed-6e56-4b1d-918d-1b774697f8b8.png	approved	\N	1	2026-10-07 11:39:49.28054+07	2026-10-07 11:39:47.25775+07
52	63	324.00	4e4bfe52-3490-4166-a73a-254deb67be38.png	approved	\N	1	2026-10-26 04:14:33.761687+07	2026-10-26 04:14:31.590983+07
53	64	324.00	e9d33091-019c-4577-9b38-c9218d66049e.png	approved	\N	1	2026-10-26 04:25:33.316649+07	2026-10-26 04:25:31.171585+07
47	47	620.00	seed-slip.png	approved	\N	1	2026-10-26 16:11:29.084275+07	2026-10-07 10:52:35.261+07
\.


--
-- Data for Name: reviews; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reviews (id, booking_id, user_id, court_id, rating, comment, created_at) FROM stdin;
1	1	4	2	5	พนักงานบริการดี	2026-09-23 11:00:00+07
2	2	6	10	4	คุ้มราคา	2026-09-23 10:00:00+07
3	3	4	6	3	ห้องน้ำสะอาด จะมาอีกแน่นอน	2026-09-23 18:00:00+07
4	4	6	11	3	สนามดีมาก ไฟสว่าง	2026-09-23 19:00:00+07
5	5	6	10	5	สนามดีมาก ไฟสว่าง	2026-09-24 13:00:00+07
6	6	5	13	3	ที่จอดรถเยอะ สะดวก	2026-09-24 12:00:00+07
7	7	6	5	4	สนามดีมาก ไฟสว่าง	2026-09-24 12:00:00+07
8	11	4	8	4	ห้องน้ำสะอาด จะมาอีกแน่นอน	2026-09-25 12:00:00+07
9	13	3	4	3	สนามดีมาก ไฟสว่าง	2026-09-26 14:00:00+07
10	14	3	5	5	คุ้มราคา	2026-09-26 10:00:00+07
11	15	6	11	3	ที่จอดรถเยอะ สะดวก	2026-09-27 16:00:00+07
12	16	4	11	5	สนามดีมาก ไฟสว่าง	2026-09-27 12:00:00+07
13	17	5	1	5	คุ้มราคา	2026-09-27 13:00:00+07
14	18	6	8	3	คุ้มราคา	2026-09-28 13:00:00+07
15	19	2	2	4	พื้นสนามดี แต่แอร์เย็นไปนิด	2026-09-28 16:00:00+07
16	20	2	2	4	พื้นสนามดี แต่แอร์เย็นไปนิด	2026-09-29 15:00:00+07
17	21	5	11	4	พนักงานบริการดี	2026-09-29 20:00:00+07
18	22	3	4	3	สนามดีมาก ไฟสว่าง	2026-09-29 12:00:00+07
19	23	6	2	3	พื้นสนามดี แต่แอร์เย็นไปนิด	2026-10-01 01:00:00+07
20	24	5	1	4	พื้นสนามดี แต่แอร์เย็นไปนิด	2026-09-30 16:00:00+07
21	26	5	1	4	พนักงานบริการดี	2026-10-01 14:00:00+07
22	27	6	11	5	พื้นสนามดี แต่แอร์เย็นไปนิด	2026-10-01 17:00:00+07
23	28	4	8	4	คุ้มราคา	2026-10-01 20:00:00+07
24	29	5	13	3	คุ้มราคา	2026-10-02 20:00:00+07
25	31	3	4	3	คุ้มราคา	2026-10-02 23:00:00+07
26	32	2	12	5	ห้องน้ำสะอาด จะมาอีกแน่นอน	2026-10-03 17:00:00+07
27	35	6	4	3	ที่จอดรถเยอะ สะดวก	2026-10-04 19:00:00+07
28	36	3	4	3	พื้นสนามดี แต่แอร์เย็นไปนิด	2026-10-04 16:00:00+07
29	37	2	9	3	พนักงานบริการดี	2026-10-05 22:00:00+07
30	38	3	13	4	พนักงานบริการดี	2026-10-05 18:00:00+07
31	39	2	11	4	คุ้มราคา	2026-10-06 17:00:00+07
32	40	5	3	3	สนามดีมาก ไฟสว่าง	2026-10-06 12:00:00+07
33	42	2	13	5	พนักงานบริการดี	2026-10-06 18:00:00+07
34	49	2	3	5	คอร์ทสะอาด ไฟสว่าง จองง่ายมาก	2026-10-07 11:17:52.276039+07
35	53	7	3	4	คอร์ทดี ไฟสว่าง 46228	2026-10-07 11:37:26.253041+07
36	59	8	3	4	คอร์ทดี ไฟสว่าง 65015	2026-10-07 11:37:45.065054+07
37	50	2	3	5	คอร์ทสะอาด ไฟสว่าง จองง่ายมาก	2026-10-07 11:39:55.267304+07
38	63	2	3	5	คอร์ทสะอาด ไฟสว่าง จองง่ายมาก	2026-10-26 04:14:40.150767+07
39	64	2	3	5	คอร์ทสะอาด ไฟสว่าง จองง่ายมาก	2026-10-26 04:25:39.672663+07
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.settings (key, value, updated_by, updated_at) FROM stdin;
promptpayId	"0842327670"	1	2026-10-27 22:28:48.523267+07
payWithinMinutes	15	1	2026-10-27 22:28:48.525789+07
cancelBeforeHours	24	1	2026-10-27 22:28:48.528363+07
maxDaysAhead	1	1	2026-10-27 22:28:48.529708+07
announcement	""	1	2026-10-27 22:28:48.53102+07
contactPhone	""	1	2026-10-27 22:28:48.532389+07
contactLine	""	1	2026-10-27 22:28:48.538637+07
address	""	1	2026-10-27 22:28:48.54014+07
checkinEarlyMinutes	60	1	2026-10-30 22:02:39.175892+07
\.


--
-- Data for Name: sports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sports (id, name, icon) FROM stdin;
1	ฟุตบอล	⚽
2	แบดมินตัน	🏸
3	บาสเกตบอล	🏀
4	เทนนิส	🎾
5	ปิงปอง	🏓
6	วอลเลย์บอล	🏐
13	ฟุตซอล	🥅
14	ว่ายน้ำ	🏊
15	มวยไทย	🥊
16	สนุกเกอร์	🎱
17	โบว์ลิ่ง	🎳
18	กอล์ฟ	⛳
19	ยิงธนู	🏹
20	ปีนผา	🧗
21	ฮอกกี้	🏑
22	เบสบอล	⚾
23	รักบี้	🏉
24	ฟันดาบ	🤺
25	ฟิตเนส	🏋️
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, password_hash, name, phone, avatar_url, role, status, created_at) FROM stdin;
1	admin@sporthub.local	$argon2id$v=19$m=65536,p=4,t=3$pa+KiBD/J+xpd9m1Vun1NA$z2+3ws8Svhsj+dw7O5JRgQOKXfDJ6IX6U1tJEsHiXtY	ผู้ดูแลระบบ	0800000000	\N	admin	active	2026-10-07 11:17:35.078638+07
2	member@sporthub.local	$argon2id$v=19$m=65536,p=4,t=3$Rimrz8r2YVgE8LsBfrVcJA$P/ig5IU7jHNBJA16Q2rLjh0FSw4zUYiX6jDC/lXrK6I	สมชาย ใจดี	0812345678	\N	member	active	2026-10-07 11:17:35.078638+07
3	somying@sporthub.local	$argon2id$v=19$m=65536,p=4,t=3$Rimrz8r2YVgE8LsBfrVcJA$P/ig5IU7jHNBJA16Q2rLjh0FSw4zUYiX6jDC/lXrK6I	สมหญิง รักกีฬา	0898765432	\N	member	active	2026-10-07 11:17:35.078638+07
4	anan@sporthub.local	$argon2id$v=19$m=65536,p=4,t=3$Rimrz8r2YVgE8LsBfrVcJA$P/ig5IU7jHNBJA16Q2rLjh0FSw4zUYiX6jDC/lXrK6I	อนันต์ วิ่งเร็ว	0861112222	\N	member	active	2026-10-07 11:17:35.078638+07
5	pim@sporthub.local	$argon2id$v=19$m=65536,p=4,t=3$Rimrz8r2YVgE8LsBfrVcJA$P/ig5IU7jHNBJA16Q2rLjh0FSw4zUYiX6jDC/lXrK6I	พิมพ์ชนก ตีแบด	0873334444	\N	member	active	2026-10-07 11:17:35.078638+07
6	krit@sporthub.local	$argon2id$v=19$m=65536,p=4,t=3$CESgpLl05RVK1tMaW7tVHA$YyDQ4qJvhyyxGLo26JY5gAnU9cKpxpZRdNX5C9+9kIU	กฤษดา ชู้ตไกล	0845556666	\N	member	active	2026-10-07 11:17:35.078638+07
7	e2e.1791347842473@example.com	$argon2id$v=19$m=65536,p=4,t=3$zepHJ4+SDPDd0wnCFS0mBA$NVD1upKMItYeJoArwqVFt1Q+GQ/vJanZAFIrB5p/inM	ทดสอบ อีทูอี	\N	\N	member	active	2026-10-07 11:37:22.852536+07
8	e2e.1791347861254@example.com	$argon2id$v=19$m=65536,p=4,t=3$4Xt4Z5nPU14Up4IB+26f3A$QeJmAqH23h7PXt6ZMS/jzbSQ1qsw8j8nDvesaHDbkMM	ทดสอบ อีทูอี	\N	\N	member	active	2026-10-07 11:37:41.675056+07
\.


--
-- Name: booking_equipment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.booking_equipment_id_seq', 35, true);


--
-- Name: booking_slots_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.booking_slots_id_seq', 96, true);


--
-- Name: bookings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.bookings_id_seq', 66, true);


--
-- Name: coupons_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.coupons_id_seq', 8, true);


--
-- Name: courts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.courts_id_seq', 33, true);


--
-- Name: emails_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.emails_id_seq', 24, true);


--
-- Name: equipment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.equipment_id_seq', 28, true);


--
-- Name: payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payments_id_seq', 53, true);


--
-- Name: reviews_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.reviews_id_seq', 39, true);


--
-- Name: sports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sports_id_seq', 63, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 8, true);


--
-- Name: booking_equipment booking_equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_equipment
    ADD CONSTRAINT booking_equipment_pkey PRIMARY KEY (id);


--
-- Name: booking_slots booking_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_slots
    ADD CONSTRAINT booking_slots_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_checkin_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_checkin_token_key UNIQUE (checkin_token);


--
-- Name: bookings bookings_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_code_key UNIQUE (code);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_code_key UNIQUE (code);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: courts courts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courts
    ADD CONSTRAINT courts_pkey PRIMARY KEY (id);


--
-- Name: emails emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_pkey PRIMARY KEY (id);


--
-- Name: equipment equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (name);


--
-- Name: booking_slots no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_slots
    ADD CONSTRAINT no_overlap EXCLUDE USING gist (court_id WITH =, tstzrange(start_at, end_at) WITH &&) WHERE (active);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_booking_id_court_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_booking_id_court_id_key UNIQUE (booking_id, court_id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: sports sports_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sports
    ADD CONSTRAINT sports_name_key UNIQUE (name);


--
-- Name: sports sports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sports
    ADD CONSTRAINT sports_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: booking_equipment_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_equipment_active ON public.booking_equipment USING btree (equipment_id) WHERE active;


--
-- Name: emails_by_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX emails_by_user ON public.emails USING btree (user_id, created_at DESC);


--
-- Name: one_cart_per_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX one_cart_per_user ON public.bookings USING btree (user_id) WHERE (status = 'cart'::public.booking_status);


--
-- Name: booking_equipment booking_equipment_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_equipment
    ADD CONSTRAINT booking_equipment_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_equipment booking_equipment_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_equipment
    ADD CONSTRAINT booking_equipment_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(id);


--
-- Name: booking_slots booking_slots_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_slots
    ADD CONSTRAINT booking_slots_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_slots booking_slots_court_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_slots
    ADD CONSTRAINT booking_slots_court_id_fkey FOREIGN KEY (court_id) REFERENCES public.courts(id);


--
-- Name: bookings bookings_coupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id);


--
-- Name: bookings bookings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: courts courts_sport_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courts
    ADD CONSTRAINT courts_sport_id_fkey FOREIGN KEY (sport_id) REFERENCES public.sports(id);


--
-- Name: emails emails_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: emails emails_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: equipment equipment_sport_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_sport_id_fkey FOREIGN KEY (sport_id) REFERENCES public.sports(id);


--
-- Name: payments payments_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: payments payments_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: reviews reviews_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_court_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_court_id_fkey FOREIGN KEY (court_id) REFERENCES public.courts(id);


--
-- Name: reviews reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: settings settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict R6uFaQopdieEuuOB3BEdpq83chZKH3L8623bkLxrBrdGXIuFgtUMFgkSxMbfUfc

