import { SiteContent } from "../models/SiteContent";
import { PlanConfig } from "../models/PlanConfig";
import { PlatformSettings } from "../models/PlatformSettings";
import { logger } from "../utils/logger";

/**
 * Seed default content, plans, and settings.
 * Run once during initial setup or when content is missing.
 */

export async function seedDefaultContent(): Promise<void> {
  // --- Site Content ---
  const defaultContents = [
    // Hero Section
    {
      key: "hero_title",
      category: "hero",
      title: "Turn Your Android Phone Into a Personal SMS Gateway",
      body: "Send, receive, and manage SMS through your own device using the Messages Lab platform.",
      isActive: true,
    },
    {
      key: "hero_subtitle",
      category: "hero",
      body: "Simple, reliable, secure, and user-friendly SMS management powered by your own SIM card.",
      isActive: true,
    },
    {
      key: "hero_cta_primary",
      category: "hero",
      title: "Get Started Free",
      body: "/register",
      isActive: true,
    },
    {
      key: "hero_cta_secondary",
      category: "hero",
      title: "View Pricing",
      body: "/pricing",
      isActive: true,
    },
    {
      key: "hero_badge",
      category: "hero",
      title: "Your Phone. Your SIM. Your Gateway.",
      isActive: true,
    },

    // Header
    {
      key: "header_logo_text",
      category: "header",
      title: "Messages Lab",
      isActive: true,
    },
    {
      key: "header_tagline",
      category: "header",
      body: "Your Personal SMS Gateway",
      isActive: true,
    },

    // Footer
    {
      key: "footer_copyright",
      category: "footer",
      body: "© 2026 Messages Lab. All rights reserved.",
      isActive: true,
    },
    // Features Section
    {
      key: "features_section_title",
      category: "features",
      title: "Why Choose Messages Lab?",
      body: "Everything you need to manage SMS through your own device.",
      isActive: true,
    },
    {
      key: "feature_own_device",
      category: "features",
      title: "Your Own Device",
      body: "Use your own Android phone as the SMS gateway. No third-party hardware needed.",
      metadata: { icon: "smartphone", order: 1 },
      isActive: true,
    },
    {
      key: "feature_own_sim",
      category: "features",
      title: "Your Own SIM",
      body: "Messages are sent through your own SIM card and mobile package. Full control over costs.",
      metadata: { icon: "sim-card", order: 2 },
      isActive: true,
    },
    {
      key: "feature_web_dashboard",
      category: "features",
      title: "Web Dashboard",
      body: "Compose, send, and manage SMS from a modern web dashboard. No technical skills required.",
      metadata: { icon: "dashboard", order: 3 },
      isActive: true,
    },
    {
      key: "feature_bulk_sms",
      category: "features",
      title: "Bulk SMS",
      body: "Send messages to multiple recipients with controlled delivery and real-time status tracking.",
      metadata: { icon: "bulk", order: 4 },
      isActive: true,
    },
    {
      key: "feature_security",
      category: "features",
      title: "Security First",
      body: "Rate limiting, encryption, audit logs, and abuse protection built into every layer.",
      metadata: { icon: "shield", order: 5 },
      isActive: true,
    },
    {
      key: "feature_transparency",
      category: "features",
      title: "Full Transparency",
      body: "Clear permission explanations, status tracking, and complete control over your device connection.",
      metadata: { icon: "eye", order: 6 },
      isActive: true,
    },

    // Pricing Section
    {
      key: "pricing_section_title",
      category: "pricing",
      title: "Choose Your Plan",
      body: "Start free and upgrade as you grow. All plans use your own SIM card for SMS delivery.",
      isActive: true,
    },
    {
      key: "pricing_section_note",
      category: "pricing",
      body: "SMS delivery uses your own mobile package. Standard carrier charges may apply.",
      isActive: true,
    },

    // Announcement Banner (disabled by default)
    {
      key: "announcement_banner",
      category: "announcement",
      title: "Welcome to Messages Lab!",
      body: "Our platform is now live. Start sending SMS through your own device today.",
      metadata: { type: "info", dismissible: true },
      isActive: false,
    },

    // How It Works Section
    {
      key: "how_it_works_title",
      category: "how-it-works",
      title: "How It Works",
      body: "Get started in just a few simple steps.",
      isActive: true,
    },
    {
      key: "how_it_works_step_1",
      category: "how-it-works",
      title: "Create an Account",
      body: "Sign up for free and verify your email address.",
      metadata: { step: 1 },
      isActive: true,
    },
    {
      key: "how_it_works_step_2",
      category: "how-it-works",
      title: "Install the Android App",
      body: "Download the Messages Lab app on your Android phone and grant the required permissions.",
      metadata: { step: 2 },
      isActive: true,
    },
    {
      key: "how_it_works_step_3",
      category: "how-it-works",
      title: "Connect Your Device",
      body: "Scan the QR code or enter the pairing code to connect your phone to your account.",
      metadata: { step: 3 },
      isActive: true,
    },
    {
      key: "how_it_works_step_4",
      category: "how-it-works",
      title: "Start Sending SMS",
      body: "Use the web dashboard to compose and send SMS through your own device and SIM.",
      metadata: { step: 4 },
      isActive: true,
    },
    // Footer Social & Contact (Admin-editable)
    {
      key: "footer_social_facebook",
      category: "footer",
      body: "https://facebook.com/messagelab",
      isActive: true,
    },
    {
      key: "footer_support_email",
      category: "footer",
      body: "support@messagelab.tech",
      isActive: true,
    },
    {
      key: "footer_tagline",
      category: "footer",
      body: "Made with ❤️ in Bangladesh",
      isActive: true,
    },
    {
      key: "footer_description",
      category: "footer",
      body: "Turn your Android phone into a personal SMS gateway. Send, receive, and manage SMS through your own device.",
      isActive: true,
    },
  ];

  for (const content of defaultContents) {
    await SiteContent.findOneAndUpdate(
      { key: content.key },
      { $setOnInsert: content },
      { upsert: true }
    );
  }

  logger.info("Default site content seeded");

  // --- Plans ---
  const defaultPlans = [
    {
      planId: "free",
      name: "free",
      displayName: "Free",
      description:
        "Get started with basic SMS capabilities using your own device and SIM.",
      priceMonthly: 0,
      priceYearly: 0,
      currency: "BDT",
      maxRecipientsPerCampaign: 10,
      maxDailyMessages: 50,
      maxDevices: 1,
      minSmsDelayMs: 3000,
      features: [
        "Up to 10 recipients per campaign",
        "1 connected device",
        "50 messages per day",
        "Basic dashboard",
        "Email support",
      ],
      isActive: true,
      sortOrder: 1,
    },
    {
      planId: "pro",
      name: "pro",
      displayName: "Pro",
      description:
        "Higher limits and additional capabilities for growing users.",
      priceMonthly: 299,
      priceYearly: 2990,
      currency: "BDT",
      maxRecipientsPerCampaign: 20,
      maxDailyMessages: 500,
      maxDevices: 1,
      minSmsDelayMs: 3000,
      features: [
        "Up to 20 recipients per campaign",
        "1 connected device",
        "500 messages per day",
        "Priority support",
        "Campaign analytics",
        "Message templates",
      ],
      isActive: true,
      sortOrder: 2,
    },
    {
      planId: "enterprise",
      name: "enterprise",
      displayName: "Enterprise",
      description:
        "Highest usage limits and advanced functionality for organizations.",
      priceMonthly: 999,
      priceYearly: 9990,
      currency: "BDT",
      maxRecipientsPerCampaign: 999999,
      maxDailyMessages: 5000,
      maxDevices: 5,
      minSmsDelayMs: 3000,
      features: [
        "Unlimited recipients per campaign",
        "Up to 5 connected devices",
        "5000 messages per day",
        "Dedicated support",
        "Advanced analytics",
        "API access",
        "Custom integrations",
      ],
      isActive: true,
      sortOrder: 3,
    },
  ];

  for (const plan of defaultPlans) {
    await PlanConfig.findOneAndUpdate(
      { planId: plan.planId },
      { $setOnInsert: plan },
      { upsert: true }
    );
  }

  logger.info("Default plan configurations seeded");

  // --- Platform Settings ---
  const defaultSettings = [
    {
      key: "maintenance_mode",
      value: false,
      valueType: "boolean",
      description: "Enable maintenance mode to block all non-admin requests",
      category: "platform",
    },
    {
      key: "registration_open",
      value: true,
      valueType: "boolean",
      description: "Allow new user registration",
      category: "platform",
    },
    {
      key: "sms_min_delay_ms",
      value: 3000,
      valueType: "number",
      description: "Minimum delay between SMS transmissions in milliseconds",
      category: "sms",
    },
    {
      key: "sms_max_message_length",
      value: 2000,
      valueType: "number",
      description: "Maximum character length for a single SMS message body",
      category: "sms",
    },
    {
      key: "email_verification_expiry_hours",
      value: 24,
      valueType: "number",
      description: "Hours before email verification token expires",
      category: "email",
    },
    {
      key: "device_heartbeat_timeout_minutes",
      value: 5,
      valueType: "number",
      description: "Minutes without heartbeat before device is marked offline",
      category: "device",
    },
    {
      key: "rate_limit_window_ms",
      value: 900000,
      valueType: "number",
      description: "Global rate limit window in milliseconds",
      category: "security",
    },
    {
      key: "rate_limit_max_requests",
      value: 300,
      valueType: "number",
      description: "Maximum requests per window per IP",
      category: "security",
    },
  ];

  for (const setting of defaultSettings) {
    await PlatformSettings.findOneAndUpdate(
      { key: setting.key },
      { $setOnInsert: setting },
      { upsert: true }
    );
  }

  logger.info("Default platform settings seeded");
}