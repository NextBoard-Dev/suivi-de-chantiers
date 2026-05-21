


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."prune_dashboard_logins"() RETURNS "void"
    LANGUAGE "sql"
    AS $$
  DELETE FROM public.dashboard_logins
  WHERE ts < now() - interval '90 days';
$$;


ALTER FUNCTION "public"."prune_dashboard_logins"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."app_states" (
    "user_id" "uuid" NOT NULL,
    "state_json" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_states" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chantier_internal_techs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site" "text" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chantier_internal_techs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chantier_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "owner_type" "text",
    "vendor" "text",
    "start_date" "date",
    "end_date" "date",
    "progress" integer DEFAULT 0 NOT NULL,
    "statuses" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "duration_days" integer DEFAULT 0 NOT NULL,
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "estimated_cost" numeric(12,2),
    "actual_cost" numeric(12,2),
    "penalty_amount" numeric(12,2),
    "internal_tech" "text"
);


ALTER TABLE "public"."chantier_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chantier_time_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "text" NOT NULL,
    "project_id" "text",
    "date_key" "date" NOT NULL,
    "role_key" "text" NOT NULL,
    "intervenant_label" "text" NOT NULL,
    "internal_tech" "text",
    "minutes" integer NOT NULL,
    "note" "text" DEFAULT ''::"text",
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chantier_time_logs_minutes_check" CHECK ((("minutes" >= 0) AND ("minutes" <= 1440))),
    CONSTRAINT "chantier_time_logs_role_key_check" CHECK (("role_key" = ANY (ARRAY['interne'::"text", 'externe'::"text", 'rsg'::"text", 'ri'::"text"])))
);


ALTER TABLE "public"."chantier_time_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chantier_time_logs_mobile_dev" (
    "id" "uuid",
    "task_id" "text",
    "project_id" "text",
    "date_key" "date",
    "role_key" "text",
    "intervenant_label" "text",
    "internal_tech" "text",
    "minutes" integer,
    "note" "text",
    "created_date" timestamp with time zone,
    "updated_date" timestamp with time zone
);


ALTER TABLE "public"."chantier_time_logs_mobile_dev" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chantier_vendors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site" "text" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chantier_vendors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chantiers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "site" "text",
    "subproject" "text",
    "lifecycle_status" "text" DEFAULT 'a_planifier'::"text" NOT NULL,
    "progress" integer DEFAULT 0 NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "budget_estimated" numeric(12,2),
    "budget_actual" numeric(12,2),
    "penalty_amount" numeric(12,2)
);


ALTER TABLE "public"."chantiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dashboard_logins" (
    "id" bigint NOT NULL,
    "user_id" "text" NOT NULL,
    "email" "text",
    "name" "text",
    "role" "text",
    "ts" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dashboard_logins" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."dashboard_logins_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."dashboard_logins_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."dashboard_logins_id_seq" OWNED BY "public"."dashboard_logins"."id";



CREATE TABLE IF NOT EXISTS "public"."dashboard_sessions" (
    "id" bigint NOT NULL,
    "token_hash" "text" NOT NULL,
    "email" "text",
    "name" "text",
    "role" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dashboard_sessions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."dashboard_sessions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."dashboard_sessions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."dashboard_sessions_id_seq" OWNED BY "public"."dashboard_sessions"."id";



CREATE TABLE IF NOT EXISTS "public"."dashboard_users" (
    "user_id" "uuid" NOT NULL,
    "users_json" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."dashboard_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_profiles_role_check" CHECK (("role" = ANY (ARRAY['ADMIN'::"text", 'USER'::"text"])))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."dashboard_logins" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."dashboard_logins_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."dashboard_sessions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."dashboard_sessions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."app_states"
    ADD CONSTRAINT "app_states_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."chantier_internal_techs"
    ADD CONSTRAINT "chantier_internal_techs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chantier_tasks"
    ADD CONSTRAINT "chantier_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chantier_time_logs"
    ADD CONSTRAINT "chantier_time_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chantier_vendors"
    ADD CONSTRAINT "chantier_vendors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chantiers"
    ADD CONSTRAINT "chantiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dashboard_logins"
    ADD CONSTRAINT "dashboard_logins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dashboard_sessions"
    ADD CONSTRAINT "dashboard_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dashboard_users"
    ADD CONSTRAINT "dashboard_users_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id");



CREATE UNIQUE INDEX "chantier_time_logs_mobile_dev_unique_key" ON "public"."chantier_time_logs_mobile_dev" USING "btree" ("task_id", "date_key", "role_key", "intervenant_label", COALESCE("internal_tech", ''::"text"));



CREATE INDEX "chantier_time_logs_task_idx" ON "public"."chantier_time_logs" USING "btree" ("task_id", "date_key");



CREATE UNIQUE INDEX "chantier_time_logs_unique_key" ON "public"."chantier_time_logs" USING "btree" ("task_id", "date_key", "role_key", "intervenant_label", COALESCE("internal_tech", ''::"text"));



CREATE INDEX "idx_chantier_internal_techs_site" ON "public"."chantier_internal_techs" USING "btree" ("site");



CREATE INDEX "idx_chantier_tasks_project_id" ON "public"."chantier_tasks" USING "btree" ("project_id");



CREATE INDEX "idx_chantier_vendors_site" ON "public"."chantier_vendors" USING "btree" ("site");



CREATE INDEX "idx_dashboard_logins_ts" ON "public"."dashboard_logins" USING "btree" ("ts");



CREATE INDEX "idx_dashboard_logins_user_id" ON "public"."dashboard_logins" USING "btree" ("user_id");



CREATE INDEX "idx_dashboard_sessions_expires" ON "public"."dashboard_sessions" USING "btree" ("expires_at");



CREATE INDEX "idx_dashboard_sessions_token" ON "public"."dashboard_sessions" USING "btree" ("token_hash");



CREATE INDEX "idx_logs_date_key_desc" ON "public"."chantier_time_logs" USING "btree" ("date_key" DESC);



CREATE UNIQUE INDEX "uq_chantier_internal_techs_site_name" ON "public"."chantier_internal_techs" USING "btree" ("site", "lower"("name"));



CREATE UNIQUE INDEX "uq_chantier_vendors_site_name" ON "public"."chantier_vendors" USING "btree" ("site", "lower"("name"));



ALTER TABLE ONLY "public"."app_states"
    ADD CONSTRAINT "app_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chantier_tasks"
    ADD CONSTRAINT "chantier_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."chantiers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."app_states" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_states_delete_own" ON "public"."app_states" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "app_states_insert_own" ON "public"."app_states" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "app_states_select_own" ON "public"."app_states" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "app_states_update_own" ON "public"."app_states" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."chantier_internal_techs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chantier_internal_techs_select_auth" ON "public"."chantier_internal_techs" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."chantier_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chantier_tasks_select_auth" ON "public"."chantier_tasks" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."chantier_time_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chantier_time_logs_select_auth" ON "public"."chantier_time_logs" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."chantier_vendors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chantier_vendors_select_auth" ON "public"."chantier_vendors" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."chantiers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chantiers_select_auth" ON "public"."chantiers" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."dashboard_logins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dashboard_logins_select_auth" ON "public"."dashboard_logins" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."dashboard_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dashboard_sessions_select_auth" ON "public"."dashboard_sessions" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."dashboard_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dashboard_users_select_auth" ON "public"."dashboard_users" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."prune_dashboard_logins"() TO "anon";
GRANT ALL ON FUNCTION "public"."prune_dashboard_logins"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prune_dashboard_logins"() TO "service_role";
























GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."app_states" TO "authenticated";
GRANT ALL ON TABLE "public"."app_states" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."chantier_internal_techs" TO "authenticated";
GRANT ALL ON TABLE "public"."chantier_internal_techs" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."chantier_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."chantier_tasks" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."chantier_time_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."chantier_time_logs" TO "service_role";



GRANT ALL ON TABLE "public"."chantier_time_logs_mobile_dev" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."chantier_vendors" TO "authenticated";
GRANT ALL ON TABLE "public"."chantier_vendors" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."chantiers" TO "authenticated";
GRANT ALL ON TABLE "public"."chantiers" TO "service_role";



GRANT SELECT,INSERT,MAINTAIN ON TABLE "public"."dashboard_logins" TO "authenticated";
GRANT ALL ON TABLE "public"."dashboard_logins" TO "service_role";



GRANT ALL ON SEQUENCE "public"."dashboard_logins_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."dashboard_logins_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."dashboard_logins_id_seq" TO "service_role";



GRANT INSERT,MAINTAIN ON TABLE "public"."dashboard_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."dashboard_sessions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."dashboard_sessions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."dashboard_sessions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."dashboard_sessions_id_seq" TO "service_role";



GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."dashboard_users" TO "authenticated";
GRANT ALL ON TABLE "public"."dashboard_users" TO "service_role";



GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































