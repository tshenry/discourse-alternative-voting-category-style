import { ajax } from "discourse/lib/ajax";
import { alias } from "@ember/object/computed";
import { apiInitializer } from "discourse/lib/api";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { inject as service } from "@ember/service";
import discourseComputed from "discourse-common/utils/decorators";
import I18n from "I18n";

const votingCategories = settings.voting_categories.split("|");

export default apiInitializer("1.1", (api) => {
  api.modifyClass("component:topic-list-item", {
    pluginId: "discourse-alternative-voting-category-style",
    excerptsRouter: service("router"),
    votesLeft: alias("currentUser.votes_left"),
    userVoted: alias("topic.user_voted"),

    @discourseComputed("topic", "lastVisitedTopic")
    unboundClassNames(topic, lastVisitedTopic) {
      let classList = this._super(...arguments);
      if (!topic.can_vote) {
        classList += " non-voting";
      }
      return classList;
    },
    @discourseComputed("excerptsRouter.currentRoute.attributes.category.id")
    expandPinned(currentCategoryId) {
      return currentCategoryId &&
        (settings.include_excerpts || settings.vote_from_topic_list) &&
        votingCategories.some((c) => c === currentCategoryId.toString())
        ? true
        : this._super();
    },
    click(e) {
      const target = e.target;
      const topic = this.topic;
      if (
        target.classList.contains("topic-list-vote-button") &&
        settings.vote_from_topic_list &&
        (this.votesLeft > 0 || this.userVoted) &&
        !topic.closed &&
        topic.unread !== undefined
      ) {
        let voteCountElem = target.nextElementSibling;
        let voteCount = parseInt(voteCountElem.innerHTML);
        let voteType;

        if (target.classList.contains("can-vote")) {
          voteCountElem.innerHTML = voteCount + 1;
          voteType = "vote";

          this.set("votesLeft", this.votesLeft - 1);
          this.set("userVoted", true);

          if (this.votesLeft === 0) {
            document
              .querySelectorAll(
                ".topic-list-item:not(.closed) .topic-list-vote-button.can-vote"
              )
              .forEach((voteButton) => {
                const tli = voteButton.closest(".topic-list-item");
                if (
                  tli.classList.contains("visited") ||
                  !tli.classList.contains("unseen-topic")
                ) {
                  voteButton.classList.add("disabled");
                  voteButton.title = I18n.t(themePrefix("out_of_votes"));
                }
              });
          }
          // Ensure clicked button has proper title and class
          target.title = I18n.t(themePrefix("user_vote"));
          target.classList.remove("disabled");
        } else {
          voteCountElem.innerHTML = voteCount - 1;
          voteType = "unvote";

          this.set("votesLeft", this.votesLeft + 1);
          this.set("userVoted", false);

          if (this.votesLeft > 0) {
            document
              .querySelectorAll(
                ".topic-list-item:not(.closed) .topic-list-vote-button.can-vote"
              )
              .forEach((voteButton) => {
                const tli = voteButton.closest(".topic-list-item");
                if (
                  tli.classList.contains("visited") ||
                  !tli.classList.contains("unseen-topic")
                ) {
                  voteButton.classList.remove("disabled");
                  voteButton.title = I18n.t(themePrefix("user_no_vote"));
                }
              });
          }

          target.title = I18n.t(themePrefix("user_no_vote"));
        }

        target.classList.toggle("can-vote");

        ajax(`/voting/${voteType}`, {
          type: "POST",
          data: {
            topic_id: topic.id,
          },
        })
          .then((result) => {
            this.currentUser.setProperties({
              votes_exceeded: !result.can_vote,
              votes_left: result.votes_left,
            });
          })
          .catch(popupAjaxError);
      }
      return this._super(...arguments);
    },
  });
});
