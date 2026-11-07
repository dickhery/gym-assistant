import Array "mo:core/Array";
import List "mo:core/List";
import Iter "mo:core/Iter";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Training "../lib/Training";
import Types "../types";

mixin(
  accounts : Map.Map<Principal, Types.Account>,
  totals : { var sessions : Nat },
  durations : Map.Map<Principal, Types.Durations>,
) {
  func accountForEdit(caller : Principal) : Types.Result<Types.Account> {
    switch (accounts.get(caller)) {
      case (?account) #ok(account);
      case null {
        if (accounts.size() >= 5_000) { return #err(#limitReached("Account capacity reached.")) };
        #ok(Training.newAccount())
      };
    }
  };

  public shared query ({ caller }) func getWorkspace() : async Types.Result<Types.Workspace> {
    if (caller.isAnonymous()) { return #err(#unauthorized) };
    #ok(switch (accounts.get(caller)) {
      case null { { categories = []; exercises = []; sessionCount = 0 } };
      case (?account) Training.workspace(account, durations.get(caller));
    })
  };

  public shared ({ caller }) func saveCategory(category : Types.Category) : async Types.Result<Types.Category> {
    if (caller.isAnonymous()) { return #err(#unauthorized) };
    if (not Training.validId(category.id) or not Training.validName(category.name)) {
      return #err(#invalidInput("Enter a category name from 1 to 60 characters."));
    };
    let account = switch (accountForEdit(caller)) {
      case (#ok value) value;
      case (#err error) return #err(error);
    };
    if (account.categories.size() >= 40 and not account.categories.containsKey(category.id)) {
      return #err(#limitReached("You can have up to 40 categories."));
    };
    if (account.categories.values().any(func item = item.id != category.id and item.name.toLower() == category.name.toLower())) {
      return #err(#invalidInput("That category name is already in use."));
    };
    account.categories.add(category.id, category);
    accounts.add(caller, account);
    #ok(category)
  };

  public shared ({ caller }) func removeCategory(id : Text) : async Types.Result<()> {
    if (caller.isAnonymous()) { return #err(#unauthorized) };
    if (not Training.validId(id)) { return #err(#notFound) };
    let ?account = accounts.get(caller) else { return #ok(()) };
    account.categories.remove(id);
    let exercises = account.exercises.values().toArray();
    for (exercise in exercises.values()) {
      if (exercise.categoryIds.any(func categoryId = categoryId == id)) {
        account.exercises.add(exercise.id, {
          exercise with categoryIds = exercise.categoryIds.filter(func categoryId = categoryId != id)
        });
      };
    };
    #ok(())
  };

  public shared ({ caller }) func saveExercise(exercise : Types.Exercise) : async Types.Result<Types.Exercise> {
    if (caller.isAnonymous()) { return #err(#unauthorized) };
    if (not Training.validId(exercise.id) or not Training.validName(exercise.name)) {
      return #err(#invalidInput("Enter an exercise name from 1 to 60 characters."));
    };
    if (exercise.categoryIds.size() > 40) { return #err(#invalidInput("Too many categories.")) };
    let account = switch (accountForEdit(caller)) {
      case (#ok value) value;
      case (#err error) return #err(error);
    };
    if (account.exercises.size() >= 150 and not account.exercises.containsKey(exercise.id)) {
      return #err(#limitReached("You can have up to 150 exercises."));
    };
    let seen = Map.empty<Text, Bool>();
    for (id in exercise.categoryIds.values()) {
      if (not Training.validId(id) or not account.categories.containsKey(id) or seen.containsKey(id)) {
        return #err(#invalidInput("Choose distinct categories from your library."));
      };
      seen.add(id, true);
    };
    if (account.exercises.values().any(func item = item.id != exercise.id and item.name.toLower() == exercise.name.toLower())) {
      return #err(#invalidInput("That exercise name is already in use."));
    };
    account.exercises.add(exercise.id, exercise);
    accounts.add(caller, account);
    #ok(exercise)
  };

  public shared ({ caller }) func logSession(input : Types.SessionInput) : async Types.Result<Types.Session> {
    if (caller.isAnonymous()) { return #err(#unauthorized) };
    let { id; exerciseId; unit; sets; notes; durationSeconds } = input;
    let entry : Types.Entry = { id; exerciseId; unit; sets; notes };
    if (not Training.validId(entry.id) or not Training.validId(entry.exerciseId) or not Training.validateSets(entry.sets)) {
      return #err(#invalidInput("Enter at least one valid set."));
    };
    if (entry.notes.size() > 500) { return #err(#invalidInput("Keep notes to 500 characters.")) };
    let ?account = accounts.get(caller) else { return #err(#notFound) };
    if (not account.exercises.containsKey(entry.exerciseId)) { return #err(#notFound) };
    switch (account.byId.get(entry.id)) {
      case (?previous) {
        if (to_candid(previous.entry) != to_candid(entry)) { return #err(#conflict) };
        return #ok(Training.sessionView(previous, durations.get(caller)));
      };
      case null {};
    };
    if (account.sessions.size() >= 10_000 or totals.sessions >= 250_000) {
      return #err(#limitReached("Session capacity reached."));
    };
    if ((durationSeconds ?? (30 : Nat32)) < 30) {
      return #err(#invalidInput("Workout duration must be at least 30 seconds."));
    };
    let session : Types.StoredSession = { entry; loggedAt = Time.now() };
    let exerciseSessions = switch (account.byExercise.get(entry.exerciseId)) {
      case (?sessions) sessions;
      case null {
        let sessions = List.empty<Types.StoredSession>();
        account.byExercise.add(entry.exerciseId, sessions);
        sessions
      };
    };
    exerciseSessions.add(session);
    account.sessions.add(session);
    account.byId.add(entry.id, session);
    switch (durationSeconds) {
      case null {};
      case (?seconds) {
        let entries = switch (durations.get(caller)) {
          case (?existing) existing;
          case null {
            let fresh = Map.empty<Text, Nat32>();
            durations.add(caller, fresh);
            fresh
          };
        };
        entries.add(entry.id, seconds);
      };
    };
    totals.sessions += 1;
    #ok({ session with durationSeconds })
  };

  public shared query ({ caller }) func getHistory(exerciseId : ?Text, before : ?Nat) : async Types.Result<Types.HistoryPage> {
    if (caller.isAnonymous()) { return #err(#unauthorized) };
    let empty : Types.HistoryPage = { sessions = []; before = null };
    let ?account = accounts.get(caller) else { return #ok(empty) };
    let workoutDurations = durations.get(caller);
    switch (exerciseId) {
      case null #ok(Training.history(account.sessions, before, workoutDurations));
      case (?id) {
        if (not Training.validId(id) or not account.exercises.containsKey(id)) { return #err(#notFound) };
        let ?sessions = account.byExercise.get(id) else { return #ok(empty) };
        #ok(Training.history(sessions, before, workoutDurations))
      };
    }
  };
}
