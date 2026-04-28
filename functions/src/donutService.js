const {
  usersCollection,
  transactionsCollection,
  rosterDoc,
  teamsMappingsCollection,
  teamsDailyCollection,
  teamsProcessedCollection,
  privateProfileDoc,
} = require('./firestorePaths');
const { DAILY_LIMIT, DONUT_EMOJI } = require('./config');
const { localDateKey, localDateLabel } = require('./dateKeys');
const { mappingKeyForTeamsUser, stableTeamsId, displayNameForTeamsUser } = require('./identity');

function defaultPublicProfile(name, amountReceived = 0) {
  return {
    name,
    balance: amountReceived,
    lifetime_given: 0,
    lifetime_received: amountReceived,
    avatar_color: `hsl(${Math.floor(Math.random() * 360)}, 60%, 80%)`,
    claimed: false,
    last_training_date: null,
  };
}

async function giveDonutsFromTeams({
  db,
  FieldValue,
  activityId,
  senderTeamsUser,
  recipientTeamsUsers,
  donutCount,
  message,
  now = new Date(),
}) {
  if (!senderTeamsUser || !mappingKeyForTeamsUser(senderTeamsUser)) {
    return { ok: false, code: 'SENDER_UNMAPPED' };
  }
  if (!Array.isArray(recipientTeamsUsers) || recipientTeamsUsers.length === 0) {
    return { ok: false, code: 'NO_RECIPIENTS' };
  }
  if (!Number.isInteger(donutCount) || donutCount < 1) {
    return { ok: false, code: 'NO_DONUTS' };
  }

  const senderKey = mappingKeyForTeamsUser(senderTeamsUser);
  const uniqueRecipientUsers = [];
  const seenRecipientKeys = new Set();
  for (const recipient of recipientTeamsUsers) {
    const key = mappingKeyForTeamsUser(recipient);
    if (key && !seenRecipientKeys.has(key)) {
      seenRecipientKeys.add(key);
      uniqueRecipientUsers.push(recipient);
    }
  }

  const dateKey = localDateKey(now);
  const dateLabel = localDateLabel(now);
  const processedRef = teamsProcessedCollection(db).doc(Buffer.from(activityId || `${senderKey}-${now.toISOString()}`, 'utf8').toString('base64url'));
  const senderMappingRef = teamsMappingsCollection(db).doc(senderKey);
  const recipientMappingRefs = uniqueRecipientUsers.map((recipient) => teamsMappingsCollection(db).doc(mappingKeyForTeamsUser(recipient)));
  const rosterRef = rosterDoc(db);

  return db.runTransaction(async (transaction) => {
    const processedSnap = await transaction.get(processedRef);
    if (processedSnap.exists) {
      return { ok: false, code: 'DUPLICATE' };
    }

    const [senderMappingSnap, rosterSnap, ...recipientMappingSnaps] = await Promise.all([
      transaction.get(senderMappingRef),
      transaction.get(rosterRef),
      ...recipientMappingRefs.map((ref) => transaction.get(ref)),
    ]);

    if (!senderMappingSnap.exists) {
      return { ok: false, code: 'SENDER_UNMAPPED' };
    }

    const senderMapping = senderMappingSnap.data();
    const senderName = senderMapping.yumName;
    if (!senderName) return { ok: false, code: 'SENDER_UNMAPPED' };

    const recipientMappings = [];
    for (let i = 0; i < recipientMappingSnaps.length; i += 1) {
      const snap = recipientMappingSnaps[i];
      if (!snap.exists || !snap.data().yumName) {
        return {
          ok: false,
          code: 'RECIPIENT_UNMAPPED',
          displayName: displayNameForTeamsUser(uniqueRecipientUsers[i]),
        };
      }
      recipientMappings.push(snap.data());
    }

    const rosterData = rosterSnap.exists ? rosterSnap.data() : {};
    const removedNames = new Set(Array.isArray(rosterData.removed_names) ? rosterData.removed_names : []);
    const activeRoster = new Set((Array.isArray(rosterData.names) ? rosterData.names : []).filter((name) => !removedNames.has(name)));

    for (const mapping of recipientMappings) {
      if (mapping.yumName === senderName) return { ok: false, code: 'SELF_GIVE' };
      if (!activeRoster.has(mapping.yumName)) {
        return { ok: false, code: 'RECIPIENT_NOT_ACTIVE', yumName: mapping.yumName };
      }
    }

    const totalRequested = donutCount * recipientMappings.length;
    const isAdmin = senderName === 'Mr Rayner' || senderMapping.isAdmin === true;
    const senderPublicDocRef = usersCollection(db).doc(senderName);
    const senderPublicSnap = await transaction.get(senderPublicDocRef);
    const senderPublic = senderPublicSnap.exists ? senderPublicSnap.data() : {};
    const senderUid = senderMapping.uid || senderPublic.uid;
    const senderPrivateRef = senderUid ? privateProfileDoc(db, senderUid) : null;
    const senderDailyRef = teamsDailyCollection(db).doc(`${dateKey}_${senderKey}`);
    const senderCounterSnap = senderPrivateRef
      ? await transaction.get(senderPrivateRef)
      : await transaction.get(senderDailyRef);
    const senderCounter = senderCounterSnap.exists ? senderCounterSnap.data() : {};
    const expectedCounterDate = senderPrivateRef ? dateLabel : dateKey;
    const currentGiven = senderCounter.last_given_date === expectedCounterDate ? (senderCounter.given_today || 0) : 0;
    const remaining = Math.max(0, DAILY_LIMIT - currentGiven);

    if (!isAdmin && totalRequested > remaining) {
      return { ok: false, code: 'DAILY_LIMIT', remaining, requested: totalRequested };
    }

    const recipientPublicRefs = recipientMappings.map((mapping) => usersCollection(db).doc(mapping.yumName));
    const recipientPublicSnaps = await Promise.all(recipientPublicRefs.map((ref) => transaction.get(ref)));

    const newGivenToday = currentGiven + totalRequested;
    if (senderPrivateRef) {
      transaction.set(senderPrivateRef, {
        given_today: newGivenToday,
        last_given_date: dateLabel,
      }, { merge: true });
    } else {
      transaction.set(senderDailyRef, {
        teamsUserId: stableTeamsId(senderTeamsUser),
        yumName: senderName,
        given_today: newGivenToday,
        last_given_date: dateKey,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    if (senderPublicSnap.exists) {
      transaction.update(senderPublicDocRef, {
        lifetime_given: FieldValue.increment(totalRequested),
      });
    } else {
      transaction.set(senderPublicDocRef, {
        ...defaultPublicProfile(senderName, 0),
        lifetime_given: totalRequested,
      });
    }

    for (let i = 0; i < recipientMappings.length; i += 1) {
      const mapping = recipientMappings[i];
      const recipientRef = recipientPublicRefs[i];
      const recipientSnap = recipientPublicSnaps[i];
      const txRef = transactionsCollection(db).doc();

      if (recipientSnap.exists) {
        transaction.update(recipientRef, {
          balance: FieldValue.increment(donutCount),
          lifetime_received: FieldValue.increment(donutCount),
        });
        const recipientData = recipientSnap.data();
        if (recipientData.uid && recipientData.claimed) {
          transaction.set(privateProfileDoc(db, recipientData.uid), {
            balance: FieldValue.increment(donutCount),
          }, { merge: true });
        }
      } else {
        transaction.set(recipientRef, defaultPublicProfile(mapping.yumName, donutCount));
      }

      transaction.set(txRef, {
        fromName: senderName,
        toName: mapping.yumName,
        message: message || '',
        timestamp: FieldValue.serverTimestamp(),
        emoji: DONUT_EMOJI,
        amount: donutCount,
        likes: [],
        source: 'teams',
        teamsActivityId: activityId || null,
        teamsSenderId: stableTeamsId(senderTeamsUser),
      });
    }

    const result = {
      ok: true,
      sender: senderName,
      recipients: recipientMappings.map((mapping) => mapping.yumName),
      amountEach: donutCount,
      total: totalRequested,
    };

    transaction.set(processedRef, {
      ...result,
      senderTeamsId: stableTeamsId(senderTeamsUser),
      recipientTeamsIds: uniqueRecipientUsers.map(stableTeamsId),
      message: message || '',
      createdAt: FieldValue.serverTimestamp(),
    });

    return result;
  });
}

module.exports = {
  giveDonutsFromTeams,
  defaultPublicProfile,
};
