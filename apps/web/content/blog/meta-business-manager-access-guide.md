---
id: meta-business-manager-access-guide
title: How to Grant Meta Business Manager Access (2026 Guide)
excerpt: >-
  Stop chasing clients for Facebook and Instagram ad access. Follow this step-by-step guide to get Meta Business Manager permissions right the first time.
category: tutorials
stage: awareness
publishedAt: '2026-03-13'
readTime: 8
author:
  name: Jon High
  role: Founder
tags:
  - Meta Business Suite
  - Facebook Ads
  - Client Onboarding
  - Agency Access
  - Instagram Ads
metaTitle: How to Grant Meta Business Manager Access (2026)
metaDescription: The complete guide to granting agency access to Meta Business Manager. Fix pending requests and avoid common errors with this step-by-step tutorial.
relatedPosts:
  - how-to-get-meta-ads-access-from-clients
  - troubleshooting-guide-how-to-fix-common-ad-account-access-issues
  - client-onboarding-checklist
---

# How to Grant Meta Business Manager Access (2026 Guide)

Getting access to a client's Facebook and Instagram ad accounts should take 5 minutes. Instead, the average agency loses **2-3 hours** per client chasing "Business Manager Pending" requests and deciphering vague error messages.

Most access delays stem from a misunderstanding of Meta's two-part verification system. You need access to both the **Business Asset** (the ad account or page) and the **Business Entity** (the Business Manager itself) to run ads effectively.

This guide covers the exact steps your clients need to take to grant you full access, plus how to fix the most common permission errors.

## Why Meta Business Manager Access Matters

Meta (formerly Facebook) has consolidated almost all advertising functions into Business Manager (now officially Business Suite). Managing client assets through personal accounts is a violation of Meta's Terms of Service and puts your agency at risk.

Proper access ensures:
- **Separation of concerns:** Client data remains separate from your personal profile.
- **Team scalability:** You can add other team members or freelancers without asking the client for more permissions.
- **Asset protection:** The client retains ownership while you control execution.
- **Pixel and data access:** You can install pixels and track conversions without admin rights on the page itself.

## Understanding Meta's Access Structure

Before sending instructions to your client, verify the specific level of access required.

| Access Level | Permissions | Best For |
|--------------|-------------|----------|
| **Admin Access** | Full control, including assigning other users | Primary account lead, long-term partnerships |
| **Editor Access** | Can create and edit ads and campaigns | Media buyers, daily campaign managers |
| **Analyst Access** | View only, no editing capabilities | Reporting specialists, auditors |

**Important Note:** If you need to install the Meta Pixel on the client's website, you typically need **Admin** access to the specific Ad Account, though you do not need Admin access to the Facebook Page itself.

## Step-by-Step Guide: The Client Side Process

Send these instructions directly to your client. Ensure they are logged into the Facebook account associated with their Business Manager.

### Phase 1: Access Business Settings

1. Navigate to **[business.facebook.com](https://business.facebook.com)**.
2. Click on the **Business Settings** icon (usually a gear icon or found in the top left menu).
3. Verify they are in the correct Business Manager. The name appears at the top left of the screen.

### Phase 2: Add Your Agency to People

Meta requires two steps: adding your user profile to the business entity, and then assigning assets.

1. On the left sidebar, under **Users**, click **People**.
2. Click the blue **Add** button.
3. Enter your work email address (the one associated with your agency's Facebook account).
4. Select **Employee access** (allows them to assign specific assets) or **Admin access** (full control).
5. Click **Confirm**.
6. You will receive an email notification to accept their invitation.

**Why This Matters:** If the client skips this step and only adds you to the Ad Account, you may appear as an "Unassigned" user, leading to API errors and restricted views.

### Phase 3: Assign Ad Account Access

Once you are added to the business, the client must grant specific access to the Ad Account.

1. On the left sidebar under **Accounts**, click **Ad Accounts**.
2. Select the specific Ad Account you need to manage.
3. Click the **Add People** button.
4. Check the box next to your name/email.
5. Toggle the permission switch to **Manage Campaigns** (Editor) or **All Admin** (Admin).
6. Click **Assign**.

### Phase 4: Assign Page Access (Optional)

If your strategy involves organic posting or replying to comments, you need Page access.

1. On the left sidebar under **Accounts**, click **Pages**.
2. Select the target Page.
3. Click **Add People**.
4. Select your user.
5. Toggle permissions to **Manage Page** (Editor) or **All Admin**.
6. Click **Assign**.

### Phase 5: Partner Verification (Advanced)

If you are a Meta Business Partner, your agency has a unique Business ID. This method is faster and more secure.

1. In **Business Settings**, go to **Partners** (under "Accounts" in the left sidebar).
2. Click **Add Partner**.
3. Enter your agency's **Business ID** (ask your agency for this).
4. Select the assets to share (Ad Accounts, Pages, Pixels).
5. Click **Next**.
6. Review the permissions and click **Confirm**.

## Common Problems & Solutions

Even with correct steps, Meta's legacy systems often throw errors. Here are the most frequent issues and how to resolve them.

| Error Message | Cause | Solution |
| :--- | :--- | :--- |
| **"You don't have permission to view this account"** | User was added to Business Manager but not assigned the specific Ad Account. | Ask the client to re-check Phase 3. Ensure your email is checked and toggled ON in the Ad Account settings. |
| **"Request Pending" (Never Expires)** | The client added you, but you didn't click the email link, or the link expired. | Check your email spam folder. If expired, ask the client to remove and re-add you. |
| **"The person you are trying to add is not managed by this business"** | Your personal profile is being added instead of your agency Business Manager identity. | Log out of your personal profile. Create a separate "Agency" identity within your own Business Manager to avoid identity confusion. |
| **"Instagram Account Not Showing"** | The Instagram account is not connected to the Page in Business Manager. | Go to **Instagram Accounts** > **Add** > **Connect an Instagram Account**. The client must do this before granting you access. |
| **"Access Token Expired"** | An API connection issue between third-party tools and Meta. | The client should refresh their system password, or you should disconnect and reconnect the account in your management tool. |

## Platform Comparison: Meta vs. Google & TikTok

Meta's Business Manager is notably more complex than other platforms due to the separation of "People" (identities) and "Assets" (accounts).

| Platform | Access Complexity | Identity Requirement | Primary Pain Point |
|----------|-------------------|----------------------|--------------------|
| **Meta (Facebook)** | High | Requires Personal Profile OR Business ID | Two-step identity + asset assignment |
| **Google Ads** | Medium | Google Account (Gmail) | "Linking" existing accounts vs. "Inviting" new ones |
| **TikTok Ads** | Low | TikTok For Business Account | Simpler, but 2FA enforcement can delay logins |
| **LinkedIn Ads** | High | LinkedIn Account | Campaign Manager rarely matches Page access |

## Pro Tips for Agency Teams

### 1. Use a Dedicated Agency Identity
Never use your personal Facebook profile to manage client assets. Create a generic "Agency Admin" user profile within your own Business Manager to avoid getting locked out if an employee leaves.

### 2. Verify Access Immediately
After the client assigns access, log in immediately. Click **Business Settings** > **Ad Accounts**. Do you see the client's account? If yes, click the account name and check the right-hand panel. Does it say **"Your Account Access: [Level]"**?

### 3. Screenshot Everything
Ask the client to screenshot their "People" and "Ad Accounts" screens to confirm they assigned you correctly. This saves hours of back-and-forth troubleshooting.

### 4. Check for "Business Verification"
If the client spends over a certain threshold, Meta may require their business to be verified (uploading documents). Unverified businesses cannot add new partners easily. Check the **Business Info** section in their settings early.

## Security Best Practices

- **Principle of Least Privilege:** Only request Admin access if absolutely necessary. Standard campaign management only requires **Editor** permissions.
- **Two-Factor Authentication (2FA):** Require your team to use 2FA. If a team member's account is compromised, the client's ad spend is at risk.
- **Regular Access Audits:** Every quarter, review the "People" list in your client's Business Manager and remove users who are no longer working on the account.

## The Alternative: Streamline with AuthHub

Sending PDF guides and hoping clients follow them correctly is an operational bottleneck. It stretches client onboarding from hours to days.

AuthHub replaces manual instructions with a unified request link.

- **One Link:** Clients click a single URL to grant access to Meta, Google, TikTok, and LinkedIn simultaneously.
- **Error Detection:** AuthHub detects if a client grants partial access and prompts them to fix it instantly.
- **Automated Verification:** You receive a notification the moment access is granted, eliminating the "Did you do it yet?" email loop.

Spend your time optimizing campaigns, not troubleshooting permissions.

---

**Related Resources:**
- [Meta Ads Access Not Working? Troubleshooting Guide](/blog/troubleshooting-guide-how-to-fix-common-ad-account-access-issues)
- [Complete Client Onboarding Checklist](/blog/client-onboarding-checklist)
- [How to Get Google Ads Access](/blog/google-ads-access-agency)