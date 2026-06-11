export function waitlistJoinWhatsAppMessage(params: {
  customerName: string;
  orgName: string;
  serviceName: string;
  preferredDate: string;
  preferredTimeLabel: string;
  providerName: string;
}): string {
  return [
    '*Waitlist confirmed*',
    '',
    `Hi ${params.customerName},`,
    `You have been added to the waitlist at ${params.orgName}.`,
    '',
    `*Service:* ${params.serviceName}`,
    `*Date:* ${params.preferredDate}`,
    `*Time preference:* ${params.preferredTimeLabel}`,
    `*Provider:* ${params.providerName}`,
    '',
    'We will message you when a matching slot opens. Slots are not held — book quickly when you get the alert.',
    '',
    'Need help? Reply to this message.',
  ].join('\n');
}

export function waitlistAvailableWhatsAppMessage(params: {
  customerName: string;
  serviceName: string;
  preferredDate: string;
  preferredTimeLabel: string;
  bookUrl: string;
}): string {
  return [
    '*A slot may be available*',
    '',
    `Hi ${params.customerName},`,
    `A time may be open for *${params.serviceName}* on *${params.preferredDate}*${params.preferredTimeLabel !== 'Any time' ? ` (${params.preferredTimeLabel})` : ''}.`,
    '',
    '*Book now* (first come, first served):',
    params.bookUrl,
  ].join('\n');
}
