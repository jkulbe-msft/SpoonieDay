// Created with Squiffy 5.1.3
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=squiffy.get(rhs.substring(1));
				
                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = 'intro';
squiffy.story.id = 'e4ec58220e';
squiffy.story.sections = {
	'intro': {
		'text': "<p><strong>A day in the life of a spoonie</strong></p>\n<p>The world is full of people looking just fine. You meet them in the street, you work alongside them, they are your friends and family. </p>\n<p>But did you know that many of those persons may look fine on the outside, but they have a chronic illness that affects their energy levels? Autoimmunne disorders like Multiple Sclerosis or Lupus affect 3% of the population, chronic migraine 2% and depression 5% of adults. Many of these illnesses can be treated with medication, but not yet cured, only slowed. </p>\n<p>A common effect of all of these illnesses is fatigue, a state of uncomfortable tiredness and exhaustion that neither rest nor sleep nor coffee can resolve. Fatigue is not caused by normal life, but rather an effect of the eternal battle raging within the bodies of the affected persons.</p>\n<p>Chances are high that you know somebody who is affected, but you may not even know it.</p>\n<p>Imagine having to pay for each everyday activity with a spoonful of energy that needs to be precisely managed and planned for, so you don&#39;t run out of spoons throughout the day. In an emergency, you may borrow a spoon or two from the next day, but you know that when you do, you will need to pay back those spoons. Those persons sometimes call themselves &quot;spoonies&quot;.</p>\n<p>This game puts you in the shoes of a spoonie. Your goal is to navigate a full working day without running out of spoons, while collecting the maximum number of achievement points.</p>\n<p>Click the links in the text to make your choices. You can replay this game as often as you like to find an optimal path through your day.</p>\n<p>Choose wisely, here comes the <a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">alarm clock...</a></p>",
		'attributes': ["sp = 0"],
		'passages': {
		},
	},
	'score': {
		'text': "<p>{if sp&lt;=5:{@state=You feel tired.}}\n{if sp&lt;=3:{@state=You feel very tired. You long for the end of the day.}}\n{if sp&lt;=0:{@state=You feel extremely tired. You can barely keep your eyes open. You know that any more activity will draw from tomorrow&#39;s spoon supply.}}\n{state}<br>Spoons left: {sp}<br>Achievement points: {ap}</p>",
		'passages': {
		},
	},
	'result': {
		'text': "<p>{if sp&lt;=5:{@finalscore=You feel tired, but you still had some energy left at the end of the day. Try a more active route next time to maximise your achievements. You will feel slightly more energetic tomorrow but the amount of energy you can carry forward is limited.}}</p>\n<p>{if sp&lt;=3:{@finalscore=You feel very tired and don&#39;t have much energy left a the end of the day. Maybe try one more active choice next time you play to maximise your achievements. You will feel slightly more energetic tomorrow but the amount of energy you can carry forward is limited.}}</p>\n<p>{if sp=0:{@finalscore=Spot on. You feel extremely tired but you don&#39;t see any way you could have been more active during the day without borrowing energy from the next one.}}</p>\n<p>{if sp&lt;0:{@finalscore=You feel extremely tired. You expended more energy than you had and had to borrow from tomorrow. You will start the next day on a reduced energy level. Hopefully you&#39;ll have a weekend soon so you can spend it in bed to recover your spoons.}}</p>\n<p>{finalscore}</p>\n<p>Spoons left: {sp}<br>Achievement points: {ap}/20</p>",
		'passages': {
		},
	},
	'restart': {
		'text': "<p>Restarting...</p>",
		'js': function() {
			jQuery("#squiffy").squiffy("restart");
		},
		'passages': {
		},
	},
	'start': {
		'text': "<p>{if sp&gt;20:{@sp=21}}</p>\n<p>The alarm clock wakes you up after a long night&#39;s sleep, but you don&#39;t feel rested.</p>\n<p>You can: <a class=\"squiffy-link link-section\" data-section=\"a1\" role=\"link\" tabindex=\"0\">Get up immediately</a> or <a class=\"squiffy-link link-section\" data-section=\"c1\" role=\"link\" tabindex=\"0\">hit the snooze button</a>.</p>\n<p>{score}</p>",
		'attributes': ["ap = 0","sp+=20","groceries = 0","state = You feel OK."],
		'passages': {
		},
	},
	'breakfast': {
		'text': "<p>Time for breakfast. You can choose between: <a class=\"squiffy-link link-section\" data-section=\"a3\" role=\"link\" tabindex=\"0\">Making a healthy breakfast with freshly squeezed orange juice and a bowl of fruits, nuts and some porridge</a><br>-or-<br><a class=\"squiffy-link link-section\" data-section=\"c3\" role=\"link\" tabindex=\"0\">a simple breakfast with a cup of coffee and a piece of toast</a>.</p>\n<p>{score}</p>",
		'passages': {
		},
	},
	'ready for work': {
		'text': "<p>Get ready for work. Do you <a class=\"squiffy-link link-section\" data-section=\"a4\" role=\"link\" tabindex=\"0\">take a shower and put on new presentable clothes so you look your best during the business day</a><br>-or-<br><a class=\"squiffy-link link-section\" data-section=\"c4\" role=\"link\" tabindex=\"0\">skip the shower and throw on yesterday&#39;s comfy clothes. You can always keep the camera off in Teams, right?</a></p>\n<p>{score}</p>",
		'passages': {
		},
	},
	'socialcall': {
		'text': "<p>Pre-work social call with your team mates before you start your class delivery. Do you <a class=\"squiffy-link link-section\" data-section=\"a5\" role=\"link\" tabindex=\"0\">join the call and socialize with your colleagues</a><br>-or-<br><a class=\"squiffy-link link-section\" data-section=\"c5\" role=\"link\" tabindex=\"0\">skip the call and prepare for your delivery</a>?</p>\n<p>{score}</p>",
		'passages': {
		},
	},
	'delivery1': {
		'text': "<p>Prime time, you&#39;re delivering the morning session. You can:<br><a class=\"squiffy-link link-section\" data-section=\"a6\" role=\"link\" tabindex=\"0\">Power through until lunch with just one quick break in between - your learners expect as much content as you can give</a>!\n-or-<br><a class=\"squiffy-link link-section\" data-section=\"c6\" role=\"link\" tabindex=\"0\">Incorporate hourly breaks</a>.</p>\n<p>{score}</p>",
		'passages': {
		},
	},
	'lunchtime': {
		'text': "<p>Lunch time. You can: <a class=\"squiffy-link link-section\" data-section=\"a7\" role=\"link\" tabindex=\"0\">Go shopping for a fresh salad and buy ingredients for a healthy dinner while you&#39;re at the store</a>. \n-or-<br><a class=\"squiffy-link link-section\" data-section=\"c7\" role=\"link\" tabindex=\"0\">Raid the fridge for a quick sandwich and rest on the couch</a>\n{score}</p>",
		'passages': {
		},
	},
	'delivery2': {
		'text': "<p>The afternoon delivery session is in full swing. You can:<br><a class=\"squiffy-link link-section\" data-section=\"a8\" role=\"link\" tabindex=\"0\">Power through until the evening with just one quick break in between - your learners expect as much content as you can give</a>!\n-or-<br><a class=\"squiffy-link link-section\" data-section=\"c8\" role=\"link\" tabindex=\"0\">Incorporate hourly breaks</a>.</p>\n<p>{score}</p>",
		'passages': {
		},
	},
	'eod': {
		'text': "<p>Phew, you made it through the delivery. A reminder pops up - there&#39;s a team meeting coming up. Do you...<br><a class=\"squiffy-link link-section\" data-section=\"a9\" role=\"link\" tabindex=\"0\">...attend the meeting</a><br>-or-<br><a class=\"squiffy-link link-section\" data-section=\"c9\" role=\"link\" tabindex=\"0\">...skip the meeting and catch the recording later</a></p>\n<p>{score}</p>",
		'passages': {
		},
	},
	'dinner': {
		'text': "<p>Dinner time. You...<br><a class=\"squiffy-link link-section\" data-section=\"a11\" role=\"link\" tabindex=\"0\">..cook a healthy dinner with a load of veggies.</a><br>-or-<br><a class=\"squiffy-link link-section\" data-section=\"c11\" role=\"link\" tabindex=\"0\">..order a pizza.</a></p>\n<p>{score}</p>",
		'passages': {
		},
	},
	'evening': {
		'text': "<p>You&#39;re almost done with the day. Do you...<br><a class=\"squiffy-link link-section\" data-section=\"a12\" role=\"link\" tabindex=\"0\">...catch up on a few updates to Microsoft Learn, post about them on LinkedIn and think about a future contribution to your D&amp;I goals.</a><br>-or-<br><a class=\"squiffy-link link-section\" data-section=\"c12\" role=\"link\" tabindex=\"0\">...flop down on the bed and fire up Netflix</a>.</p>\n<p>{score}</p>",
		'passages': {
		},
	},
	'asleep': {
		'text': "<p>{result}</p>\n<p>Thank you for playing &quot;A day in the life of a spoonie&quot;. What appears to be a normal day can be a challenge for a spoonie. Spoonies need to carefully plan the day to get by with the spoons that you have. All choices have consequences, and it takes some time to learn how to balance the available amount of energy with the achievements we want to make during the day. Every day is a new challenge, so your achievement points will reset.</p>\n<p>You can choose to <a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">start a new day with your current energy level</a>. \nYou can also completely <a class=\"squiffy-link link-section\" data-section=\"restart\" role=\"link\" tabindex=\"0\">restart</a> the game.</p>",
		'passages': {
		},
	},
	'a1': {
		'text': "<p>You&#39;re up early, the weather is great. You can: <a class=\"squiffy-link link-section\" data-section=\"a2\" role=\"link\" tabindex=\"0\">Get some exercise</a><br>-or-<br><a class=\"squiffy-link link-section\" data-section=\"c2\" role=\"link\" tabindex=\"0\">skip exercise and take your time to get up</a>.</p>\n<p>{score}</p>",
		'attributes': ["sp-=2","ap+=1"],
		'passages': {
		},
	},
	'c1': {
		'text': "<p>You&#39;re still tired, but somewhat more rested. You realize it&#39;s an hour later and you missed your chance to exercise. Time to get up and go for <a class=\"squiffy-link link-section\" data-section=\"breakfast\" role=\"link\" tabindex=\"0\">breakfast</a>.</p>\n<p>{score}</p>",
		'attributes': ["sp+=1"],
		'passages': {
		},
	},
	'a2': {
		'text': "<p>You take a nice morning jog on your favorite trail. You feel you already have accomplished something today, but wonder if you will be able to hold up all day. Time for <a class=\"squiffy-link link-section\" data-section=\"breakfast\" role=\"link\" tabindex=\"0\">breakfast</a>.</p>\n<p>{score}</p>",
		'attributes': ["sp-=3","ap+=2"],
		'passages': {
		},
	},
	'c2': {
		'text': "<p>You stretch and yawn and slowly get out of bed. No need to stress yourself that early in the day. Time to go for <a class=\"squiffy-link link-section\" data-section=\"breakfast\" role=\"link\" tabindex=\"0\">breakfast</a>.</p>\n<p>{score}</p>",
		'passages': {
		},
	},
	'a3': {
		'text': "<p>Now that was both a healthy and a tasty choice, though making juice and building the perfect breakfast bowl certainly took some work. Time to get <a class=\"squiffy-link link-section\" data-section=\"ready for work\" role=\"link\" tabindex=\"0\">ready for work</a>.</p>\n<p>{score}</p>",
		'attributes': ["sp-=2","ap+=1"],
		'passages': {
		},
	},
	'c3': {
		'text': "<p>That was a quick and easy breakfast. You are grateful you have an all-in-one coffee machine that only takes the press of a button to produce a nice hot cup. You remember the days when a cup of coffee would make you wide awake. These days, it&#39;s just delicious with no extra energy, but you still get jiggy if you have too much.<br>Time to get <a class=\"squiffy-link link-section\" data-section=\"ready for work\" role=\"link\" tabindex=\"0\">ready for work</a>.\n{score}</p>",
		'attributes': ["sp-=1","ap+=0"],
		'passages': {
		},
	},
	'a4': {
		'text': "<p>A nice warm shower and a fresh set of clothes feel so good. <a class=\"squiffy-link link-section\" data-section=\"socialcall\" role=\"link\" tabindex=\"0\">You&#39;re ready for the day.</a></p>\n<p>{score}</p>",
		'attributes': ["sp-=2","ap+=1"],
		'passages': {
		},
	},
	'c4': {
		'text': "<p>Efficiency first. If you leave the camera off, nobody will notice. <a class=\"squiffy-link link-section\" data-section=\"socialcall\" role=\"link\" tabindex=\"0\">You&#39;re ready for the day.</a></p>\n<p>{score}</p>",
		'attributes': ["sp-=1","ap+=0"],
		'passages': {
		},
	},
	'a5': {
		'text': "<p>You join the social call with your colleagues. It feels good to have a few minutes to network with your peers. Time flies and you have to rush to your <a class=\"squiffy-link link-section\" data-section=\"delivery1\" role=\"link\" tabindex=\"0\">morning delivery session</a>.</p>\n<p>{score}</p>",
		'attributes': ["sp-=1","ap+=1"],
		'passages': {
		},
	},
	'c5': {
		'text': "<p>You take your time to prepare your morning delivery session. Maybe you will get a chance to talk to your colleagues later. On to the <a class=\"squiffy-link link-section\" data-section=\"delivery1\" role=\"link\" tabindex=\"0\">morning delivery session</a>.</p>\n<p>{score}</p>",
		'passages': {
		},
	},
	'a6': {
		'text': "<p>You power throgh your morning session with just one quick coffee break. You manage to present an amazing amount of content. You wonder if your learners were able to keep up and you feel exhausted. You&#39;re looking forward to <a class=\"squiffy-link link-section\" data-section=\"lunchtime\" role=\"link\" tabindex=\"0\">lunchtime</a>.</p>\n<p>{score}</p>",
		'attributes': ["sp-=5","ap+=1"],
		'passages': {
		},
	},
	'c6': {
		'text': "<p>You make sure that you have a break every hour. You have to skip a few slides to stay within the prescribed course timing, but you have a feeling that your learners had a chance to absorb the content. You feel slightly exhausted, but <a class=\"squiffy-link link-section\" data-section=\"lunchtime\" role=\"link\" tabindex=\"0\">lunchtime</a> arrives quickly.</p>\n<p>{score}</p>",
		'attributes': ["sp-=4","ap+=2"],
		'passages': {
		},
	},
	'a7': {
		'text': "<p>You buy a fresh salad and while you&#39;re at the store, you also pick up some fresh groceries for later. You feel good about making a healthy choice and you&#39;re glad to arrive back home again. After eating the salad, it&#39;s time for your <a class=\"squiffy-link link-section\" data-section=\"delivery2\" role=\"link\" tabindex=\"0\">afternoon delivery session</a>.</p>\n<p>{score}</p>",
		'attributes': ["sp-=2","ap+=2","groceries = 1"],
		'passages': {
		},
	},
	'c7': {
		'text': "<p>You cobble together a quick sandwich with leftovers from the fridge and flop down on the couch. You remember a recent employee wellness meeting about healthy eating, but right now you&#39;re just glad you have something to eat and you can rest a while. After resting, it&#39;s time for the <a class=\"squiffy-link link-section\" data-section=\"delivery2\" role=\"link\" tabindex=\"0\">afternoon delivery session</a>.</p>\n<p>{score}</p>",
		'attributes': ["sp-=1","ap+=0"],
		'passages': {
		},
	},
	'a8': {
		'text': "<p>You power throgh your afternoon session with just one quick coffee break. You manage to present an amazing amount of content. You wonder if your learners were able to keep up and you feel exhausted. You&#39;re looking forward to the <a class=\"squiffy-link link-section\" data-section=\"eod\" role=\"link\" tabindex=\"0\">end of your working day</a>.</p>\n<p>{score}</p>",
		'attributes': ["sp-=5","ap+=1"],
		'passages': {
		},
	},
	'c8': {
		'text': "<p>You make sure that you have a break every hour. You have to skip a few slides to stay within the prescribed course timing, but you have a feeling that your learners had a chance to absorb the content. You feel slightly exhausted, but the <a class=\"squiffy-link link-section\" data-section=\"eod\" role=\"link\" tabindex=\"0\">end of your working day</a> arrives quickly.</p>\n<p>{score}</p>",
		'attributes': ["sp-=4","ap+=2"],
		'passages': {
		},
	},
	'a9': {
		'text': "<p>You join the team meeting. Do you <a class=\"squiffy-link link-section\" data-section=\"a10\" role=\"link\" tabindex=\"0\">actively attend and contribute to the meeting with a presentation you created</a> or <a class=\"squiffy-link link-section\" data-section=\"c10\" role=\"link\" tabindex=\"0\">sit back and watch without contributing</a>?</p>\n<p>{score}</p>",
		'attributes': ["sp-=2","ap+=1"],
		'passages': {
		},
	},
	'c9': {
		'text': "<p>You missed the opportunity to contribute to the meeting and be visible to your colleagues. You are beginning to wonder if your manager thinks you are lazy because this is not the first meeting you missed while your calendar was free.</p>\n<p>You will need to expend a spoon on another day to catch up on the recording. You&#39;re hungry. Time to make <a class=\"squiffy-link link-section\" data-section=\"dinner\" role=\"link\" tabindex=\"0\">dinner</a>.</p>\n<p>{score}</p>",
		'passages': {
		},
	},
	'a10': {
		'text': "<p>Your presentation is great and your colleagues thank you for your valuable contribution. Your manager seems to be impressed. You feel like you have accomplished a lot.<br>{if sp&lt;=5:You feel tired and yawn during the meeting. A colleague makes a comment about partying less hard next time and others laugh. You wonder what kind of impression you&#39;re giving to your everyone.}\nYou&#39;re hungry. Time to make <a class=\"squiffy-link link-section\" data-section=\"dinner\" role=\"link\" tabindex=\"0\">dinner</a>.</p>\n<p>{score}</p>",
		'attributes': ["sp-=3","ap+=2"],
		'passages': {
		},
	},
	'c10': {
		'text': "<p>You watch the meeting without saying much. It&#39;s a good thing you can use an avatar so your colleagues don&#39;t see how tired you are. Instead of saying something, you type a few comments in the chat and use the reaction features. You hope your manager noticed your presence.\n{if sp&lt;=5:You feel tired and yawn audibly during the meeting. A colleague makes a comment about partying less hard next time and others laugh. You wonder what kind of impression you&#39;re giving to your everyone.}<br>You&#39;re hungry. Time to make <a class=\"squiffy-link link-section\" data-section=\"dinner\" role=\"link\" tabindex=\"0\">dinner</a>.</p>\n<p>{score}</p>",
		'attributes': ["sp-=1"],
		'passages': {
		},
	},
	'a11': {
		'text': "<p>{if groceries=1:{@ap+=1}}\nYou cook a nice healthy meal. Preparation takes energy, but you know that eating well is key to feeling well. In the back of your mind, the thought remains that no matter what diet you follow, it will not alter the course of your chronic illness. Right now, you still feel very good about having made a healthy choice.</p>\n<p>{if groceries=1:You&#39;re glad went to the grocery store during your lunch break. Your veggies are extra fresh.}</p>\n<p>You were thinking ahead and cooked another portion that you put in the freezer. Some day you will be very grateful for it.</p>\n<p>Time to <a class=\"squiffy-link link-passage\" data-passage=\"clean\" role=\"link\" tabindex=\"0\">clean</a> up the kitchen.</p>\n<p>{score}</p>",
		'attributes': ["sp-=2","ap+=2"],
		'passages': {
			'clean': {
				'text': "<p>The kitchen is a mess. You don&#39;t feel like it, but you definitely need to clean up. After cleaning up, you&#39;re looking forward to the <a class=\"squiffy-link link-section\" data-section=\"evening\" role=\"link\" tabindex=\"0\">evening</a>.</p>\n<p>{score}</p>",
				'attributes': ["sp-=1"],
			},
		},
	},
	'c11': {
		'text': "<p>You place a quick online order with your favorite pizza delivery service. A few minutes later, the doorbell rings. It&#39;s a quick and easy solution, and you like pizza, but you long for a freshly made healthy meal. Also you&#39;re beggining to wonder how much money you already spent on delivieries this month. Still, pizza is pizza. You&#39;re looking forward to the <a class=\"squiffy-link link-section\" data-section=\"evening\" role=\"link\" tabindex=\"0\">evening</a>.</p>\n<p>{score}</p>",
		'attributes': ["sp-=1"],
		'passages': {
		},
	},
	'a12': {
		'text': "<p>You get busy for another late-night session. You find a great new Azure feature to post about, and you gain several likes and reposts on LinkedIn. You also jot down a few ideas for an upcoming D&amp;I workshop where you plan to create a game about energy management. You feel like you have have achieved a lot and go to bed. Tomorrow is going to be a new day. For now, you fall <a class=\"squiffy-link link-section\" data-section=\"asleep\" role=\"link\" tabindex=\"0\">asleep</a>.</p>\n<p>{score}</p>",
		'attributes': ["sp-=3","ap+=2"],
		'passages': {
		},
	},
	'c12': {
		'text': "<p>Time to conserve energy. You settle down on your bed, set the alarm clock and launch Netflix to watch a few episodes of your favorite show. After a few minutes, you fall <a class=\"squiffy-link link-section\" data-section=\"asleep\" role=\"link\" tabindex=\"0\">asleep</a>.   </p>\n<p>{score}</p>",
		'passages': {
		},
	},
}
})();