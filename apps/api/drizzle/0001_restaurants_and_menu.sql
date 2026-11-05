CREATE TABLE "menu_categories" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menu_categories_name_unique" UNIQUE("restaurant_id","name"),
	CONSTRAINT "menu_categories_id_restaurant_unique" UNIQUE("id","restaurant_id"),
	CONSTRAINT "menu_categories_position_check" CHECK ("menu_categories"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer NOT NULL,
	"photo_key" text,
	"is_available" boolean DEFAULT true NOT NULL,
	"daily_stock" integer,
	"stock_remaining" integer,
	"stock_date" date,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menu_items_price_check" CHECK ("menu_items"."price_cents" >= 0),
	CONSTRAINT "menu_items_daily_stock_check" CHECK ("menu_items"."daily_stock" > 0),
	CONSTRAINT "menu_items_stock_remaining_check" CHECK ("menu_items"."stock_remaining" >= 0),
	CONSTRAINT "menu_items_stock_day_check" CHECK (("menu_items"."stock_remaining" is null) = ("menu_items"."stock_date" is null)),
	CONSTRAINT "menu_items_stock_limit_check" CHECK ("menu_items"."daily_stock" is not null or "menu_items"."stock_remaining" is null)
);
--> statement-breakpoint
CREATE TABLE "opening_hours" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"opens_at" time NOT NULL,
	"closes_at" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opening_hours_slot_unique" UNIQUE("restaurant_id","weekday","opens_at"),
	CONSTRAINT "opening_hours_weekday_check" CHECK ("opening_hours"."weekday" between 1 and 7),
	CONSTRAINT "opening_hours_times_check" CHECK ("opening_hours"."opens_at" < "opening_hours"."closes_at")
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"cuisine" text NOT NULL,
	"status" text DEFAULT 'onboarding' NOT NULL,
	"street" text NOT NULL,
	"postal_code" text NOT NULL,
	"city" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"delivery_radius_m" integer NOT NULL,
	"delivery_fee_cents" integer NOT NULL,
	"delivery_minutes_min" integer NOT NULL,
	"delivery_minutes_max" integer NOT NULL,
	"photo_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurants_status_check" CHECK ("restaurants"."status" in ('onboarding', 'active', 'paused')),
	CONSTRAINT "restaurants_photo_check" CHECK ("restaurants"."status" = 'onboarding' or "restaurants"."photo_key" is not null),
	CONSTRAINT "restaurants_latitude_check" CHECK ("restaurants"."latitude" between -90 and 90),
	CONSTRAINT "restaurants_longitude_check" CHECK ("restaurants"."longitude" between -180 and 180),
	CONSTRAINT "restaurants_delivery_radius_check" CHECK ("restaurants"."delivery_radius_m" > 0),
	CONSTRAINT "restaurants_delivery_fee_check" CHECK ("restaurants"."delivery_fee_cents" >= 0),
	CONSTRAINT "restaurants_delivery_minutes_check" CHECK ("restaurants"."delivery_minutes_min" >= 1 and "restaurants"."delivery_minutes_max" >= "restaurants"."delivery_minutes_min")
);
--> statement-breakpoint
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_fk" FOREIGN KEY ("category_id","restaurant_id") REFERENCES "public"."menu_categories"("id","restaurant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening_hours" ADD CONSTRAINT "opening_hours_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "menu_items_restaurant_idx" ON "menu_items" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "menu_items_category_idx" ON "menu_items" USING btree ("category_id");