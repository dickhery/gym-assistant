import Array "mo:core/Array";
import Char "mo:core/Char";
import Iter "mo:core/Iter";
import List "mo:core/List";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Types "../types";

module {
  public func newAccount() : Types.Account = {
    categories = Map.empty();
    exercises = Map.empty();
    sessions = List.empty();
    byExercise = Map.empty();
    byId = Map.empty();
  };

  public func validId(id : Text) : Bool {
    id.size() >= 8 and id.size() <= 64 and id.chars().all(
      func c = (c >= 'a' and c <= 'z') or (c >= '0' and c <= '9') or c == '-'
    )
  };

  public func validName(name : Text) : Bool {
    name.size() > 0 and name.size() <= 60 and name == name.trim(#predicate(Char.isWhitespace))
  };

  public func sessionView(session : Types.StoredSession, durations : ?Types.Durations) : Types.Session = {
    session with durationSeconds = switch (durations) {
      case null null;
      case (?entries) entries.get(session.entry.id);
    };
  };

  public func workspace(account : Types.Account, durations : ?Types.Durations) : Types.Workspace = {
    categories = account.categories.values().toArray();
    exercises = account.exercises.values().map<Types.Exercise, Types.ExerciseSummary>(
      func(exercise) {
        switch (account.byExercise.get(exercise.id)) {
          case null { { exercise; latest = null; sessionCount = 0 } };
          case (?sessions) {
            let latest = switch (sessions.last()) {
              case null null;
              case (?session) ?sessionView(session, durations);
            };
            { exercise; latest; sessionCount = sessions.size() }
          };
        }
      }
    ).toArray();
    sessionCount = account.sessions.size();
  };

  public func history(sessions : List.List<Types.StoredSession>, before : ?Nat, durations : ?Types.Durations) : Types.HistoryPage {
    let end = if ((before ?? sessions.size()) < sessions.size()) {
      before ?? sessions.size()
    } else { sessions.size() };
    let count = if (end < 20) { end } else { 20 };
    {
      sessions = Array.tabulate<Types.Session>(count, func index = sessionView(sessions.at(Nat.sub(end, index + 1)), durations));
      before = if (end > count) { ?(end - count) } else { null };
    }
  };

  public func validateSets(sets : [Types.LiftSet]) : Bool {
    if (sets.size() == 0 or sets.size() > 22) { return false };
    var nextSlot : Nat8 = 0;
    for (lift in sets.values()) {
      if (lift.slot < nextSlot or lift.slot > 21 or lift.weight > 500_000 or lift.reps < 1 or lift.reps > 500 or (lift.restSeconds ?? (0 : Nat16)) > 3600) {
        return false;
      };
      nextSlot := lift.slot + 1;
    };
    true
  };
}
